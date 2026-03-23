// ─── Pinned scenic nodes (stored in localStorage) ─────────────────────────────
// Used to pre-select nodes that must appear in the generated route.

export interface PinnedNode {
  id: string
  name: string
  category_label: string   // e.g. '🏰 Burg', '⛰ Gipfel'
}

const STORAGE_KEY = 'volata_pinned_nodes'
const MAX_PINNED = 5

function read(): PinnedNode[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function write(nodes: PinnedNode[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes))
}

export function getPinnedNodes(): PinnedNode[] {
  return read()
}

export function addPinnedNode(node: PinnedNode): void {
  const current = read()
  if (current.find(n => n.id === node.id)) return   // already pinned
  write([...current, node].slice(0, MAX_PINNED))
}

export function removePinnedNode(id: string): void {
  write(read().filter(n => n.id !== id))
}

export function isPinned(id: string): boolean {
  return read().some(n => n.id === id)
}

export function clearPinnedNodes(): void {
  localStorage.removeItem(STORAGE_KEY)
}
