import React from 'react';
import { Tooltip } from 'antd';
import { useExpertStore } from '@/store/expertStore';

/**
 * SkillMenu — Displays available skills/tools in the sidebar
 */
const SkillMenu: React.FC = () => {
  const { skills } = useExpertStore();

  return (
    <div className="px-1 space-y-0.5">
      {skills.map((skill) => (
        <Tooltip key={skill.id} title={skill.description} placement="right">
          <div
            className="flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer"
            style={{ color: '#a0a0a0' }}
          >
            <span className="truncate">{skill.name}</span>
          </div>
        </Tooltip>
      ))}
    </div>
  );
};

export default SkillMenu;
