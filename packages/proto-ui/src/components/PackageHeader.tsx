import { DocBlock } from "./DocBlock"
import { FileSourceLink } from "./FileSourceLink"

export type PackageHeaderProps = {
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
    {fileSourceUrl ? <FileSourceLink href={fileSourceUrl} /> : null}
    <DocBlock raw={leadingComment} />
  </header>
)
