namespace HowDidWeGetHere.Domain.Enums;

public enum ActorType
{
    Person,
    Group,
    Civilization,
    Empire,
    Organization,
    Deity,
    Creature,
    Culture,
    Other
}

public enum ContentStatus
{
    Draft,
    Published,
    Archived
}

public enum EntryActorRole
{
    Explorer,
    Inventor,
    Author,
    Ruler,
    Climber,
    Civilization,
    Deity,
    Subject,
    Participant,
    Founder,
    Other
}

public enum EntryKind
{
    Event,
    Invention,
    MythologyEntity,
    MythologyStory,
    Period,
    Discovery,
    Exploration,
    War,
    Civilization,
    Person,
    Place,
    Text,
    Technology,
    ScientificConcept,
    Other
}

public enum EntryPlaceRole
{
    MainSite,
    Origin,
    Destination,
    Stop,
    Region,
    Birthplace,
    Battlefield,
    CultSite,
    CreatedIn,
    PublishedIn,
    Other
}

public enum EntryRelationshipType
{
    Caused,
    Influenced,
    Preceded,
    Followed,
    PartOf,
    HasPart,
    RelatedTo,
    Contradicts,
    SameTraditionAs,
    LocatedWithin,
    DerivedFrom,
    Other
}

public enum ImageKind
{
    Primary,
    Gallery,
    Map,
    Portrait,
    Artifact,
    Manuscript,
    Symbol,
    Other
}

public enum ImportStatus
{
    Pending,
    Imported,
    PartiallyImported,
    Failed
}

public enum PeriodMembershipType
{
    Primary,
    Overlaps,
    Starts,
    Ends,
    BelongsTo
}

public enum PlaceType
{
    City,
    Country,
    Region,
    Site,
    Mountain,
    Ocean,
    River,
    RouteStop,
    MythicPlace,
    Space,
    Continent,
    Other
}

public enum RealityStatus
{
    Historical,
    Mythological,
    Legendary,
    Disputed,
    Interpretive,
    Fictional
}

public enum RoutePointRole
{
    Start,
    Stop,
    End,
    Summit,
    BaseCamp,
    Approximate,
    Other
}

public enum RouteType
{
    Voyage,
    Expedition,
    Migration,
    Conquest,
    Climb,
    TradeRoute,
    Mission,
    Journey,
    Other
}

public enum SourceSupportKind
{
    General,
    Date,
    Summary,
    Route,
    Location,
    Relationship,
    Image,
    Translation
}

public enum SpatialConfidence
{
    Exact,
    Approximate,
    Regional,
    Disputed,
    Mythic,
    Unknown
}

public enum StorageProvider
{
    Local,
    S3,
    AzureBlob,
    ExternalUrl
}

public enum TimePeriodType
{
    Era,
    Age,
    Dynasty,
    Reign,
    Movement,
    WarPeriod,
    CivilizationPeriod,
    CulturalPeriod,
    GeologicalPeriod,
    Other
}

public enum TimePrecision
{
    ExactDate,
    Year,
    Decade,
    Century,
    Millennium,
    Range,
    Approximate,
    Unknown
}

