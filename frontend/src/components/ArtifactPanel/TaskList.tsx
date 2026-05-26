import React from 'react';
import { Empty, Progress, Button, Tooltip } from 'antd';
import {
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PauseCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useAppStore } from '@/store';
import { useArtifactStore } from '@/store/artifactStore';
import type { TaskItem } from '@/types/artifact';

const statusIconMap = {
  pending: <PauseCircleOutlined style={{ color: '#faad14' }} />,
  running: <LoadingOutlined style={{ color: '#1890ff' }} />,
  completed: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  failed: <CloseCircleOutlined style={{ color: '#f5222d' }} />,
  cancelled: <CloseCircleOutlined style={{ color: '#bfbfbf' }} />,
};

/**
 * TaskList — Displays background tasks in the right panel
 */
const TaskList: React.FC = () => {
  const { theme } = useAppStore();
  const { tasks, removeTask } = useArtifactStore();
  const isDark = theme === 'dark';

  const textColor = isDark ? '#e0e0e0' : '#262626';
  const mutedColor = isDark ? '#888888' : '#8c8c8c';
  const hoverBg = isDark ? '#2a2a2a' : '#f5f5f5';

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span style={{ color: mutedColor, fontSize: 12 }}>
              暂无任务
            </span>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-2 space-y-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="px-3 py-3 rounded-lg"
          style={{ backgroundColor: isDark ? '#252525' : '#f9f9f9' }}
        >
          <div className="flex items-center gap-2 mb-2">
            {statusIconMap[task.status]}
            <span className="text-sm font-medium flex-1 truncate" style={{ color: textColor }}>
              {task.name}
            </span>
            <Tooltip title="删除">
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                style={{ color: mutedColor }}
                onClick={() => removeTask(task.id)}
              />
            </Tooltip>
          </div>
          {task.description && (
            <div className="text-xs mb-2 truncate" style={{ color: mutedColor }}>
              {task.description}
            </div>
          )}
          <Progress
            percent={task.progress}
            size="small"
            status={
              task.status === 'failed'
                ? 'exception'
                : task.status === 'completed'
                ? 'success'
                : 'active'
            }
            showInfo={false}
            strokeColor={
              task.status === 'failed'
                ? '#f5222d'
                : task.status === 'completed'
                ? '#52c41a'
                : '#1890ff'
            }
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs" style={{ color: mutedColor }}>
              {task.status === 'running' && task.expertName
                ? `${task.expertName} 执行中`
                : task.status === 'completed'
                ? '已完成'
                : task.status === 'failed'
                ? '失败'
                : '等待中'}
            </span>
            <span className="text-xs" style={{ color: mutedColor }}>
              {task.progress}%
            </span>
          </div>
          {task.errorMessage && (
            <div className="text-xs mt-1 p-1.5 rounded" style={{ backgroundColor: '#fff2f0', color: '#f5222d' }}>
              {task.errorMessage}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default TaskList;
