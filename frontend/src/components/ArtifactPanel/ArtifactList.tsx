import React from 'react';
import { Empty, Button, Tooltip } from 'antd';
import {
  FileTextOutlined,
  BarChartOutlined,
  GlobalOutlined,
  TableOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  DownloadOutlined,
  EyeOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useAppStore } from '@/store';
import { useArtifactStore } from '@/store/artifactStore';
import type { Artifact, ArtifactType } from '@/types/artifact';

const artifactIconMap: Record<ArtifactType, React.ReactNode> = {
  document: <FileTextOutlined />,
  chart: <BarChartOutlined />,
  map: <GlobalOutlined />,
  table: <TableOutlined />,
  image: <PictureOutlined />,
  video: <VideoCameraOutlined />,
  report: <FileTextOutlined />,
};

const artifactColorMap: Record<ArtifactType, string> = {
  document: '#1890ff',
  chart: '#52c41a',
  map: '#722ed1',
  table: '#fa8c16',
  image: '#eb2f96',
  video: '#f5222d',
  report: '#13c2c2',
};

/**
 * ArtifactList — Displays generated artifacts in the right panel
 */
const ArtifactList: React.FC = () => {
  const { theme } = useAppStore();
  const { artifacts, activeArtifactId, setActiveArtifact, removeArtifact } = useArtifactStore();
  const isDark = theme === 'dark';

  const textColor = isDark ? '#e0e0e0' : '#262626';
  const mutedColor = isDark ? '#888888' : '#8c8c8c';
  const hoverBg = isDark ? '#2a2a2a' : '#f5f5f5';
  const activeBg = isDark ? '#2a3a3a' : '#e6fffb';

  if (artifacts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span style={{ color: mutedColor, fontSize: 12 }}>
              暂无产物
              <br />
              AI 生成的报告、图表、地图将显示在这里
            </span>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      {artifacts.map((artifact) => (
        <ArtifactItem
          key={artifact.id}
          artifact={artifact}
          isActive={activeArtifactId === artifact.id}
          isDark={isDark}
          textColor={textColor}
          mutedColor={mutedColor}
          hoverBg={hoverBg}
          activeBg={activeBg}
          onSelect={() => setActiveArtifact(artifact.id)}
          onDelete={() => removeArtifact(artifact.id)}
        />
      ))}
    </div>
  );
};

interface ArtifactItemProps {
  artifact: Artifact;
  isActive: boolean;
  isDark: boolean;
  textColor: string;
  mutedColor: string;
  hoverBg: string;
  activeBg: string;
  onSelect: () => void;
  onDelete: () => void;
}

const ArtifactItem: React.FC<ArtifactItemProps> = ({
  artifact,
  isActive,
  isDark,
  textColor,
  mutedColor,
  hoverBg,
  activeBg,
  onSelect,
  onDelete,
}) => {
  const icon = artifactIconMap[artifact.type];
  const color = artifactColorMap[artifact.type];

  return (
    <div
      className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg cursor-pointer group transition-colors"
      style={{
        backgroundColor: isActive ? activeBg : 'transparent',
      }}
      onClick={onSelect}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = hoverBg;
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: color + '15', color }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate" style={{ color: isActive ? color : textColor }}>
          {artifact.name}
        </div>
        <div className="text-xs truncate" style={{ color: mutedColor }}>
          {formatTime(artifact.createdAt)}
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {artifact.previewUrl && (
          <Tooltip title="预览">
            <Button type="text" size="small" icon={<EyeOutlined />} style={{ color: mutedColor }} />
          </Tooltip>
        )}
        {artifact.downloadUrl && (
          <Tooltip title="下载">
            <Button type="text" size="small" icon={<DownloadOutlined />} style={{ color: mutedColor }} />
          </Tooltip>
        )}
        <Tooltip title="删除">
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            style={{ color: '#f5222d' }}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          />
        </Tooltip>
      </div>
    </div>
  );
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default ArtifactList;
