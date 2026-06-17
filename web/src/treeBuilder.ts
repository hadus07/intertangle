export interface TreeNode {
  name: string
  path: string
  isFile: boolean
  children: TreeNode[]
}

// Synthesize a folder tree from project-relative file paths. Folders are
// intermediate path segments; the leaf is the file.
export function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', isFile: false, children: [] }

  for (const path of paths) {
    const segments = path.split('/')
    let node = root
    for (let i = 0; i < segments.length; i++) {
      const name = segments[i]
      const isFile = i === segments.length - 1
      const childPath = segments.slice(0, i + 1).join('/')
      let child = node.children.find((c) => c.name === name && c.isFile === isFile)
      if (!child) {
        child = { name, path: childPath, isFile, children: [] }
        node.children.push(child)
      }
      node = child
    }
  }

  sort(root)
  return root.children
}

// Folders first, then files; alpha within each group.
function sort(node: TreeNode): void {
  node.children.sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1
    return a.name.localeCompare(b.name)
  })
  for (const child of node.children) sort(child)
}

export function descendantFiles(node: TreeNode): string[] {
  if (node.isFile) return [node.path]
  return node.children.flatMap(descendantFiles)
}
