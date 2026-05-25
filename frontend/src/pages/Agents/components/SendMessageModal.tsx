/**
 * 发送消息给 Agent 的弹窗
 */
import React, { useState } from 'react';
import { Modal, Input, Typography, Tag, Space, List } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import { agentApi, safeCall } from '@/services/api';
import type { AgentMessageResponse } from '@/services/types';

const { Paragraph } = Typography;
const { TextArea } = Input;

interface SendMessageModalProps {
  open: boolean;
  agentId: string;
  agentName: string;
  onCancel: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    iterations?: number;
    tools_used?: string[];
    hallucination_risk?: number;
  };
}

const SendMessageModal: React.FC<SendMessageModalProps> = ({
  open,
  agentId,
  agentName,
  onCancel,
}) => {
  const [inputMsg, setInputMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleSend = async () => {
    if (!inputMsg.trim()) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: inputMsg.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputMsg('');
    setSending(true);

    const result = await safeCall(() => agentApi.sendMessage(agentId, userMsg.content));
    if (result) {
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: result.message,
        timestamp: new Date(),
        metadata: {
          iterations: result.iterations,
          tools_used: result.tools_used,
          hallucination_risk: result.hallucination_risk,
        },
      };
      setMessages((prev) => [...prev, assistantMsg]);
    }

    setSending(false);
  };

  const handleCancel = () => {
    setMessages([]);
    setInputMsg('');
    onCancel();
  };

  return (
    <Modal
      title={
        <Space>
          <RobotOutlined />
          <span>与 {agentName} 对话</span>
        </Space>
      }
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={640}
      destroyOnClose
    >
      <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 16 }}>
        {messages.length === 0 && (
          <Paragraph type="secondary" className="text-center py-8">
            输入消息开始对话
          </Paragraph>
        )}
        <List
          dataSource={messages}
          renderItem={(msg) => (
            <div
              className="mb-3"
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '80%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  backgroundColor: msg.role === 'user' ? '#1890ff' : '#f0f0f0',
                  color: msg.role === 'user' ? '#fff' : 'inherit',
                }}
              >
                <div className="flex items-center gap-1 mb-1">
                  {msg.role === 'assistant' ? <RobotOutlined /> : <UserOutlined />}
                  <span className="font-medium text-xs">
                    {msg.role === 'assistant' ? agentName : '你'}
                  </span>
                  {msg.metadata && (
                    <Space size={4}>
                      {msg.metadata.hallucination_risk !== undefined && (
                        <Tag
                          color={msg.metadata.hallucination_risk > 0.3 ? 'red' : 'green'}
                          style={{ fontSize: 10, lineHeight: '16px' }}
                        >
                          风险 {msg.metadata.hallucination_risk.toFixed(2)}
                        </Tag>
                      )}
                      {msg.metadata.iterations !== undefined && (
                        <Tag style={{ fontSize: 10, lineHeight: '16px' }}>
                          {msg.metadata.iterations} 轮
                        </Tag>
                      )}
                    </Space>
                  )}
                </div>
                <div>{msg.content}</div>
              </div>
            </div>
          )}
        />
      </div>

      <Space.Compact style={{ width: '100%' }}>
        <TextArea
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          placeholder="输入消息..."
          autoSize={{ minRows: 1, maxRows: 3 }}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={sending}
        />
        <a
          className="ant-btn ant-btn-primary ant-btn-icon-only"
          onClick={handleSend}
          style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <SendOutlined />
        </a>
      </Space.Compact>
    </Modal>
  );
};

export default SendMessageModal;
