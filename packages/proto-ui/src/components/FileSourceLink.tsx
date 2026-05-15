export type FileSourceLinkProps = {
  href: string
  label?: string
}

export const FileSourceLink = ({ href, label = "View source" }: FileSourceLinkProps) => (
  <a className="proto-file-source-link" href={href} target="_blank" rel="noreferrer noopener">
    {label}
  </a>
)
