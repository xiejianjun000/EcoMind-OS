"use client"

import { useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { File, FolderOpen, RefreshCw, Loader2 } from "lucide-react"
import { scanKnowledgeBase, clearKnowledgeCache, type KnowledgeCategory, type KnowledgeFile } from "@/services/knowledgeService"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * KnowledgeList — 本地资料库文件列表
 *
 * 从后端 API 获取本地扫描文件，按分类展示。
 * 支持点击展开分类、刷新扫描。
 */
interface KnowledgeListProps {
  onFileClick?: (file: KnowledgeFile) => void
}

export function KnowledgeList({ onFileClick }: KnowledgeListProps) {
  const [categories, setCategories] = useState<KnowledgeCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({})
  const [totalFiles, setTotalFiles] = useState(0)

  const loadData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      if (forceRefresh) clearKnowledgeCache();
      const result = await scanKnowledgeBase();
      setCategories(result.categories);
      setTotalFiles(result.total_files);
      // 默认展开第一个分类
      if (result.categories.length > 0 && Object.keys(expandedCats).length === 0) {
        setExpandedCats({ [result.categories[0].id]: true });
      }
    } catch (e: any) {
      console.warn('[KnowledgeList] 扫描失败:', e);
      setError(e.message || '扫描失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleCategory = (catId: string) => {
    setExpandedCats(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const getFileIcon = (ext: string): string => {
    const map: Record<string, string> = {
      '.pdf': '📄', '.doc': '📝', '.docx': '📝',
      '.xls': '📊', '.xlsx': '📊', '.csv': '📊',
      '.json': '📋', '.xml': '📋',
      '.md': '📖', '.txt': '📃',
      '.pptx': '📽️', '.ppt': '📽️',
      '.png': '🖼️', '.jpg': '🖼️', '.jpeg': '🖼️',
    };
    return map[ext] || '📎';
  };

  const handleFileClick = (file: KnowledgeFile) => {
    if (onFileClick) {
      onFileClick(file)
    } else {
      const fileUrl = `file://${encodeURI(file.path)}`
      window.open(fileUrl, '_blank')
    }
  };

  if (loading) {
    return (
      <div className="px-2 py-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        正在扫描本地文件...
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-2 py-3">
        <div className="text-xs text-red-500 mb-2">扫描失败: {error}</div>
        <button
          onClick={() => loadData(true)}
          className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
        >
          <RefreshCw className="h-3 w-3" />
          重试
        </button>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="px-2 py-4 text-xs text-muted-foreground text-center">
        未找到文件 · 请确认 ~/Documents 或 ~/Desktop 中有文件
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-0.5">
        {/* 刷新按钮 + 总文件数 */}
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs text-muted-foreground">
            共 {totalFiles} 个文件
          </span>
          <button
            onClick={() => loadData(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="刷新扫描"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>

        {categories.map((cat) => {
          const isExpanded = expandedCats[cat.id] || false;
          return (
            <div key={cat.id}>
              {/* 分类标题 */}
              <button
                onClick={() => toggleCategory(cat.id)}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded-md transition-colors"
              >
                <span className="text-xs">{cat.icon}</span>
                <span className="flex-1 text-left text-xs font-medium truncate">
                  {cat.name}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {cat.count}
                </span>
              </button>

              {/* 文件列表 */}
              {isExpanded && (
                <div className="ml-4 space-y-0.5 max-h-[200px] overflow-y-auto">
                  {cat.files.slice(0, 50).map((file, idx) => (
                    <Tooltip key={`${file.name}-${idx}`}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleFileClick(file)}
                          className="flex items-center gap-1.5 w-full px-2 py-1 rounded text-xs hover:bg-accent transition-colors text-left group"
                        >
                          <span className="text-xs shrink-0">
                            {getFileIcon(file.extension)}
                          </span>
                          <span className="flex-1 truncate group-hover:text-foreground">
                            {file.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100">
                            {file.size_display}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs max-w-[300px]">
                        <p className="font-medium">{file.name}</p>
                        <p className="text-muted-foreground">{file.path}</p>
                        <p>{file.size_display} · {file.modified}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {cat.files.length > 50 && (
                    <div className="text-[10px] text-muted-foreground px-2 py-1">
                      ...还有 {cat.files.length - 50} 个文件
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
