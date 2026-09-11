import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileText,
  FileJson,
  Image as ImageIcon,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  FolderTree,
} from 'lucide-react';
import { cn } from '../lib/utils';
import './FileTree.css';

export interface TreeNode {
  id: string;
  name: string;
  isFolder: boolean;
  children?: TreeNode[];
  depth: number;
}

/**
 * Heuristic to detect if a code block or string is a file tree
 */
export function looksLikeFileTree(text: string): boolean {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return false;

  const treeCharacters = /(├──|└──|│\s+|[├└]──|──\s)/;
  const matchCount = lines.filter((l) => treeCharacters.test(l)).length;
  if (matchCount >= 2) return true;

  // Indented file hierarchy (e.g. ends with / or has extensions)
  const slashFolderCount = lines.filter((l) => /^\s*[\w\.\-]+\/\s*$/.test(l)).length;
  const fileExtCount = lines.filter((l) => /\.\w{1,5}$/.test(l.trim())).length;
  return slashFolderCount >= 1 && fileExtCount >= 2;
}

/**
 * Parse ASCII tree or indented lines into a nested TreeNode structure
 */
export function parseTreeText(raw: string): TreeNode[] {
  const lines = raw.trim().split('\n');
  const rootNodes: TreeNode[] = [];
  const stack: { depth: number; node: TreeNode }[] = [];

  let nextId = 1;

  for (const line of lines) {
    if (!line.trim()) continue;

    // Clean ASCII tree symbols: ├──, └──, │, etc.
    const cleanLine = line
      .replace(/[│├└─]+/g, (m) => ' '.repeat(m.length))
      .replace(/^\s*[|+-]+\s*/, '');

    // Measure indentation depth
    const leadingSpaces = cleanLine.search(/\S|$/);
    const depth = Math.floor(leadingSpaces / 2);
    const trimmed = cleanLine.trim();

    if (!trimmed) continue;

    const isFolder = trimmed.endsWith('/') || !/\.\w{1,5}$/.test(trimmed);
    const name = trimmed.replace(/\/$/, '');

    const node: TreeNode = {
      id: `node-${nextId++}`,
      name,
      isFolder,
      depth,
      children: isFolder ? [] : undefined,
    };

    // Find parent in stack
    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootNodes.push(node);
    } else {
      const parent = stack[stack.length - 1].node;
      if (parent.children) {
        parent.children.push(node);
      }
    }

    if (isFolder) {
      stack.push({ depth, node });
    }
  }

  return rootNodes;
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'rs':
    case 'go':
    case 'c':
    case 'cpp':
    case 'java':
      return <FileCode size={14} className="file-icon file-icon-code" />;
    case 'json':
    case 'yaml':
    case 'yml':
    case 'toml':
      return <FileJson size={14} className="file-icon file-icon-json" />;
    case 'md':
    case 'txt':
    case 'rst':
      return <FileText size={14} className="file-icon file-icon-doc" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
    case 'gif':
    case 'webp':
      return <ImageIcon size={14} className="file-icon file-icon-img" />;
    default:
      return <File size={14} className="file-icon file-icon-default" />;
  }
}

interface TreeItemProps {
  node: TreeNode;
  expandedFolders: Set<string>;
  toggleFolder: (id: string) => void;
}

const TreeItem: React.FC<TreeItemProps> = ({ node, expandedFolders, toggleFolder }) => {
  const isExpanded = expandedFolders.has(node.id);

  if (node.isFolder) {
    return (
      <div className="filetree-folder-group">
        <div
          className="filetree-row filetree-folder-row"
          style={{ paddingLeft: `${node.depth * 14 + 6}px` }}
          onClick={() => toggleFolder(node.id)}
        >
          <span className="filetree-arrow">
            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
          <span className="filetree-icon">
            {isExpanded ? (
              <FolderOpen size={14} className="folder-icon folder-icon-open" />
            ) : (
              <Folder size={14} className="folder-icon" />
            )}
          </span>
          <span className="filetree-name folder-name">{node.name}/</span>
        </div>

        {isExpanded && node.children && node.children.length > 0 && (
          <div className="filetree-children">
            {node.children.map((child) => (
              <TreeItem
                key={child.id}
                node={child}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="filetree-row filetree-file-row"
      style={{ paddingLeft: `${node.depth * 14 + 22}px` }}
    >
      <span className="filetree-icon">{getFileIcon(node.name)}</span>
      <span className="filetree-name file-name">{node.name}</span>
    </div>
  );
};

export interface FileTreeProps {
  data: string;
  title?: string;
  className?: string;
}

export const FileTree: React.FC<FileTreeProps> = ({
  data,
  title = 'Estrutura de Arquivos',
  className,
}) => {
  const [copied, setCopied] = useState(false);
  const tree = useMemo(() => parseTreeText(data), [data]);

  // Initially expand all folders
  const allFolderIds = useMemo(() => {
    const ids: string[] = [];
    const traverse = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.isFolder) {
          ids.push(n.id);
          if (n.children) traverse(n.children);
        }
      }
    };
    traverse(tree);
    return ids;
  }, [tree]);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(allFolderIds)
  );

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => setExpandedFolders(new Set(allFolderIds));
  const collapseAll = () => setExpandedFolders(new Set());

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) {}
  };

  return (
    <div className={cn('filetree-container', className)}>
      <div className="filetree-header">
        <div className="filetree-header-left">
          <FolderTree size={14} className="filetree-header-icon" />
          <span className="filetree-header-title">{title}</span>
        </div>

        <div className="filetree-actions">
          <button
            type="button"
            className="filetree-action-btn"
            onClick={expandedFolders.size > 0 ? collapseAll : expandAll}
            title={expandedFolders.size > 0 ? 'Recolher todos' : 'Expandir todos'}
          >
            {expandedFolders.size > 0 ? 'Recolher' : 'Expandir'}
          </button>
          <button
            type="button"
            className="filetree-action-btn"
            onClick={handleCopy}
            title="Copiar estrutura"
          >
            {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
        </div>
      </div>

      <div className="filetree-body">
        {tree.length === 0 ? (
          <div className="filetree-empty">Nenhum arquivo listado.</div>
        ) : (
          tree.map((node) => (
            <TreeItem
              key={node.id}
              node={node}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default FileTree;
