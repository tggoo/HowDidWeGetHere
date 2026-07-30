import { ChevronLeft, ChevronRight, X } from 'lucide-react'

type LightboxImage = {
  image: {
    id: string
    altText?: string | null
  }
  url: string
}

type ImageLightboxLabels = {
  closeImage: string
  imageIndicator: (current: number, total: number) => string
  imageSlide: (current: number, total: number) => string
  nextImage: string
  previousImage: string
}

type ImageLightboxProps = {
  activeImageIndex: number
  hasMultipleImages: boolean
  image?: LightboxImage['image'] | null
  imageCount: number
  images: LightboxImage[]
  imageUrl: string
  labels: ImageLightboxLabels
  title: string
  onClose: () => void
  onShowAdjacentImage: (direction: -1 | 1) => void
  onShowImage: (index: number) => void
}

export function ImageLightbox({
  activeImageIndex,
  hasMultipleImages,
  image,
  imageCount,
  images,
  imageUrl,
  labels,
  onClose,
  onShowAdjacentImage,
  onShowImage,
  title,
}: ImageLightboxProps) {
  return (
    <div
      className="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={labels.imageSlide(activeImageIndex + 1, imageCount)}
      onClick={onClose}
    >
      <button className="image-lightbox-close" type="button" aria-label={labels.closeImage} title={labels.closeImage} onClick={onClose}>
        <X aria-hidden="true" />
      </button>
      {hasMultipleImages && (
        <>
          <button
            className="image-lightbox-nav previous"
            type="button"
            aria-label={labels.previousImage}
            title={labels.previousImage}
            onClick={(event) => {
              event.stopPropagation()
              onShowAdjacentImage(-1)
            }}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            className="image-lightbox-nav next"
            type="button"
            aria-label={labels.nextImage}
            title={labels.nextImage}
            onClick={(event) => {
              event.stopPropagation()
              onShowAdjacentImage(1)
            }}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </>
      )}
      <img
        alt={image?.altText ?? title}
        className="image-lightbox-img"
        onClick={(event) => event.stopPropagation()}
        src={imageUrl}
      />
      {hasMultipleImages && (
        <div className="entry-image-indicators lightbox" onClick={(event) => event.stopPropagation()}>
          {images.map((item, index) => (
            <button
              className={index === activeImageIndex ? 'active' : undefined}
              key={item.image.id}
              type="button"
              aria-current={index === activeImageIndex ? 'true' : undefined}
              aria-label={labels.imageIndicator(index + 1, imageCount)}
              onClick={() => onShowImage(index)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
