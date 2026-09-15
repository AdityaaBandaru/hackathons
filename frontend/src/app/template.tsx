/**
 * A template re-mounts on every navigation (unlike a layout), which is what
 * gives each page its own entrance animation.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-up">{children}</div>;
}
