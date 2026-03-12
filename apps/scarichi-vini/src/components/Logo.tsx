export function Logo({ variant }: { variant: 'intro' | 'header' }) {
  const className = variant === 'intro' ? 'logoIntro' : 'logoHeader';

  return (
    <picture>
      <source srcSet="/logo.webp" type="image/webp" />
      <img
        className={className}
        src="/logo.png"
        alt="Enoteca Italiana"
        loading={variant === 'intro' ? 'eager' : 'lazy'}
        decoding="async"
        width={1024}
        height={240}
      />
    </picture>
  );
}
