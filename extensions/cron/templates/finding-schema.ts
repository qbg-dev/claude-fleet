export type Finding = {
  id: string
  severity: 'p0' | 'p1' | 'p2' | 'p3'
  category: string                        // project-specific, derived from actual findings
  description: string
  files: string[]
  evidence: string
  suggested_fix: string
  effort?: 'trivial' | 'small' | 'medium' | 'large'
  tags?: string[]
}
