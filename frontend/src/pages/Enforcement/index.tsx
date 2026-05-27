import React from 'react';
import EnforcementList from './EnforcementList';

/**
 * 执法办案模块 — 入口容器
 * 直接渲染 EnforcementList 作为默认视图。
 * 详情和创建页面通过路由 /enforcement/:caseId 和 /enforcement/create 独立渲染。
 */
const EnforcementPage: React.FC = () => <EnforcementList />;

export default EnforcementPage;
