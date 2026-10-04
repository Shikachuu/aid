import { DocBlock } from "./DocBlock"

type PackageHeaderProps = {
  packageName: string | null
  leadingComment: string | null
  fileSourceUrl?: string
}

export const PackageHeader = ({
  packageName,
  leadingComment,
  fileSourceUrl,
}: PackageHeaderProps) => (
  <header className="proto-package-header">
    {packageName ? (
      <h1 className="proto-package-name">
        <span className="proto-package-keyword">package</span> {packageName}
      </h1>
    ) : null}
    {fileSourceUrl ? (
      <a
        className="proto-file-source-link"
        href={fileSourceUrl}
        target="_blank"
        rel="noreferrer noopener"
      >
        View source
      </a>
    ) : null}
    <DocBlock raw={leadingComment} />
  </header>
)
