import React from 'react';
import { Breadcrumb, Typography, Space } from 'antd';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

interface BreadcrumbItem {
  title: string;
  path?: string;
}

interface Props {
  title: string;
  icon?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  extra?: React.ReactNode;
}

export const PageHeader: React.FC<Props> = ({ title, icon, breadcrumbs, extra }) => {
  const navigate = useNavigate();

  return (
    <div style={{ marginBottom: 24 }}>
      {breadcrumbs && (
        <Breadcrumb
          style={{ marginBottom: 8 }}
          items={breadcrumbs.map((b) => ({
            title: b.path ? (
              <a onClick={() => b.path && navigate(b.path)} style={{ cursor: 'pointer' }}>
                {b.title}
              </a>
            ) : b.title,
          }))}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
          <Space>
            {icon}
            {title}
          </Space>
        </Title>
        {extra && <div>{extra}</div>}
      </div>
    </div>
  );
};

export default PageHeader;
