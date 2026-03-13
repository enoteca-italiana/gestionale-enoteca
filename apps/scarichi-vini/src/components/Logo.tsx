export function Logo({ variant }: { variant: 'intro' | 'header' }) {
  const className = variant === 'intro' ? 'logoIntro' : 'logoHeader';

  return (
    <img
      className={className}
      src="/logo.png"
      alt="Enoteca Italiana"
      loading={variant === 'intro' ? 'eager' : 'lazy'}
      decoding="async"
      width={1024}
      height={240}
    />
  );
}
