#!/bin/bash

set -e

API_PROJECT="src/HowDidWeGetHere.Api/HowDidWeGetHere.Api.csproj"
INFRA_PROJECT="src/HowDidWeGetHere.Infrastructure/HowDidWeGetHere.Infrastructure.csproj"
FRONTEND_DIR="web"
CONTEXT="HistoryDbContext"
PROFILE="${2:-http}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

run_backend() {
  echo "Spoustim backend..."
  dotnet run --project "$API_PROJECT" --launch-profile "$PROFILE" --no-restore
}

build_backend() {
  echo "Sestavuji backend..."
  dotnet build "$API_PROJECT" --no-restore
}

install_frontend_dependencies() {
  echo "Instaluji frontend zavislosti..."
  cd "$FRONTEND_DIR" || exit
  npm install
  cd - >/dev/null || exit
}

run_frontend() {
  echo "Spoustim frontend..."
  cd "$FRONTEND_DIR" || exit
  npm run dev
}

run_app() {
  echo "Spoustim backend i frontend..."
  dotnet run --project "$API_PROJECT" --launch-profile http --no-restore &
  backend_pid=$!

  cd "$FRONTEND_DIR" || exit
  npm run dev &
  frontend_pid=$!
  cd - >/dev/null || exit

  trap 'kill $backend_pid $frontend_pid 2>/dev/null || true' EXIT
  wait
}

run_database() {
  echo "Spoustim PostgreSQL/PostGIS v dockeru..."
  docker compose --file docker-compose.DEV.yml up -d postgres
}

stop_database() {
  echo "Zastavuji PostgreSQL/PostGIS docker..."
  docker compose --file docker-compose.DEV.yml down
}

run_docker_stack() {
  echo "Spoustim lokalni Docker stack..."
  docker compose --file docker-compose.DEV.yml up -d --build
  echo "Frontend: http://localhost:5173"
  echo "API:      http://localhost:5141/api/health"
}

build_docker_stack() {
  echo "Sestavuji lokalni Docker image..."
  docker compose --file docker-compose.DEV.yml build
}

stop_docker_stack() {
  echo "Zastavuji lokalni Docker stack..."
  docker compose --file docker-compose.DEV.yml down
}

add_migration() {
  if [ -z "$1" ]; then
    echo "Chyba: Je vyzadovano jmeno migrace."
    echo "Pouziti: ./run.sh add migration <jmenoMigrace>"
    exit 1
  fi

  migration_name="$1"
  dotnet build "$API_PROJECT" --no-restore

  echo "Pridavam PostgreSQL migraci '$migration_name'..."
  dotnet ef migrations add "$migration_name" \
    --project "$INFRA_PROJECT" \
    --startup-project "$API_PROJECT" \
    --context "$CONTEXT" \
    --no-build
}

update_database() {
  echo "Aktualizuji PostgreSQL databazi..."
  dotnet ef database update \
    --project "$INFRA_PROJECT" \
    --startup-project "$API_PROJECT" \
    --context "$CONTEXT"
}

generate_sql_script() {
  echo "Generuji PostgreSQL SQL migracni script..."
  dotnet ef migrations script -i \
    --project "$INFRA_PROJECT" \
    --startup-project "$API_PROJECT" \
    --context "$CONTEXT" \
    -o postgresql-migrations.sql
}

remove_migration() {
  echo "Odstranuji posledni PostgreSQL migraci..."
  dotnet ef migrations remove \
    --project "$INFRA_PROJECT" \
    --startup-project "$API_PROJECT" \
    --context "$CONTEXT"
}

generate_api_client() {
  echo "Generuji typovane API pro frontend..."
  cd "$FRONTEND_DIR" || exit
  npm run generate:api
  cd - >/dev/null || exit
}

build_frontend() {
  echo "Sestavuji frontend..."
  cd "$FRONTEND_DIR" || exit
  npm run build
  cd - >/dev/null || exit
}

frontend_install_library() {
  if [ -z "$1" ]; then
    echo "Chyba: Je vyzadovan nazev npm knihovny."
    echo "Pouziti: ./run.sh fil <js-library>"
    exit 1
  fi

  cd "$FRONTEND_DIR" || exit
  npm install "$1"
  cd - >/dev/null || exit
}

commit_no_verify() {
  git commit --no-verify -m "$1"
}

push_no_verify() {
  git push --no-verify
}

contains_entries_json() {
  local root="$1"
  local first_match

  if [[ -f "$root/entries.json" ]]; then
    return 0
  fi

  first_match="$(find "$root" -mindepth 1 -maxdepth 2 -type f -name entries.json -print -quit 2>/dev/null || true)"
  [[ -n "$first_match" ]]
}

resolve_audio_dir() {
  local path="$1"
  if [[ ! -d "$path" ]]; then
    echo "Adresar neexistuje: $path" >&2
    exit 1
  fi
  (cd "$path" && pwd -P)
}

run_audio_pipeline() {
  local packages_root="${1:-$PWD}"
  local python_bin="${PYTHON:-python}"
  local audio_root="${AUDIO_ROOT:-$SCRIPT_DIR/generated/audio}"
  local default_packages_root
  local tts_args=()

  if [[ $# -gt 0 && "${1:-}" != --* ]]; then
    shift
  else
    packages_root="$PWD"
  fi

  packages_root="$(resolve_audio_dir "$packages_root")"
  if ! contains_entries_json "$packages_root"; then
    default_packages_root="$SCRIPT_DIR/generated/packages"
    if [[ "$packages_root" == "$SCRIPT_DIR" && -d "$default_packages_root" ]] && contains_entries_json "$default_packages_root"; then
      packages_root="$(resolve_audio_dir "$default_packages_root")"
      echo "V aktualnim adresari neni entries.json. Pouzivam $packages_root."
    else
      echo "V $packages_root ani v jeho primych podadresarich neni entries.json." >&2
      exit 1
    fi
  fi

  if [[ -n "${TTS_ROOT:-}" ]]; then
    tts_args=(--tts-root "$TTS_ROOT")
  fi

  echo "Package root: $packages_root"
  echo "Plaintext/MP3 workspace: $audio_root"
  echo "Spoustim audio pipeline."

  "$python_bin" "$SCRIPT_DIR/tools/generate-translation-audio.py" \
    --packages-root "$packages_root" \
    --out "$audio_root" \
    --overwrite \
    --generate \
    --clean-package-audio \
    "${tts_args[@]}" \
    "$@"
}

case "$1" in
  be)
    run_backend
    ;;
  bbe)
    build_backend
    ;;
  fe)
    run_frontend
    ;;
  bfe)
    build_frontend
    ;;
  app)
    run_app
    ;;
  docker)
    run_docker_stack
    ;;
  docker-build)
    build_docker_stack
    ;;
  docker-down)
    stop_docker_stack
    ;;
  db)
    run_database
    ;;
  db-down)
    stop_database
    ;;
  audio)
    shift
    run_audio_pipeline "$@"
    ;;
  install)
    if [ "$2" == "fe-deps" ]; then
      install_frontend_dependencies
    else
      echo "Chyba: Neplatny install prikaz."
      exit 1
    fi
    ;;
  add)
    if [ "$2" == "migration" ]; then
      add_migration "$3"
    else
      echo "Chyba: Neplatny add prikaz."
      exit 1
    fi
    ;;
  udb)
    update_database
    ;;
  sql)
    generate_sql_script
    ;;
  rmm)
    remove_migration
    ;;
  genapi)
    generate_api_client
    ;;
  fil)
    frontend_install_library "$2"
    ;;
  cnv)
    commit_no_verify "$2"
    ;;
  pnv)
    push_no_verify
    ;;
  *)
    echo "Chyba: Neplatny prikaz."
    echo "Pouziti:"
    echo "  be                    - spusti backend (volitelne: ./run.sh be <profile>, default http)"
    echo "  bbe                   - sestavi backend"
    echo "  fe                    - spusti frontend"
    echo "  bfe                   - sestavi frontend"
    echo "  app                   - spusti backend i frontend"
    echo "  docker                - sestavi a spusti lokalni Docker stack (PostGIS, API, frontend)"
    echo "  docker-build          - sestavi lokalni Docker image"
    echo "  docker-down           - zastavi lokalni Docker stack"
    echo "  db                    - spusti PostgreSQL/PostGIS docker"
    echo "  db-down               - zastavi PostgreSQL/PostGIS docker"
    echo "  audio [packages-dir]  - vygeneruje plaintext, MP3, audio reference a package ZIPy"
    echo "  install fe-deps       - nainstaluje frontend zavislosti"
    echo "  add migration <jmeno> - prida PostgreSQL migraci"
    echo "  udb                   - aplikuje migrace do PostgreSQL"
    echo "  sql                   - vygeneruje postgresql-migrations.sql"
    echo "  rmm                   - odstrani posledni migraci"
    echo "  genapi                - vygeneruje typovane API pro frontend"
    echo "  fil <js-library>      - nainstaluje npm knihovnu"
    echo "  cnv <commit-msg>      - git commit --no-verify"
    echo "  pnv                   - git push --no-verify"
    exit 1
    ;;
esac
