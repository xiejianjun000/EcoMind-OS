/**
 * 日历模块 — 环境监测任务调度 · 会议管理 · 执法排班
 *
 * 功能: 月视图日历、事件 CRUD、工作日计算、事件统计
 * 技术: Ant Design Calendar + Card + Tag + Drawer + ECharts
 */
import React, { useState, useEffect, useMemo } from 'react'
import {
  Calendar as AntCalendar,
  Card,
  Tag,
  Typography,
  Space,
  Row,
  Col,
  Button,
  Select,
  Drawer,
  Descriptions,
  message,
  Spin,
  Popconfirm,
  Statistic,
  Empty,
  Modal,
  Form,
  Input,
  DatePicker,
  Switch,
  Radio,
} from 'antd'
import {
  DeleteOutlined,
  ReloadOutlined,
  CalendarOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
  AuditOutlined,
  TeamOutlined,
  FieldTimeOutlined,
  PlusOutlined,
  EditOutlined,
} from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
dayjs.locale('zh-cn')
import { calendarApi, CalendarEvent } from '@/services/calendarApi'
import ReactECharts from 'echarts-for-react'

const { Title, Text } = Typography

const EVENT_TYPE_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  task: { color: 'blue', icon: <FileTextOutlined />, label: '监测任务' },
  meeting: { color: 'purple', icon: <TeamOutlined />, label: '会议' },
  enforcement: { color: 'red', icon: <ThunderboltOutlined />, label: '执法' },
  approval: { color: 'orange', icon: <AuditOutlined />, label: '审批' },
  report: { color: 'cyan', icon: <FileTextOutlined />, label: '报告' },
}

const PRIORITY_COLOR: Record<string, string> = {
  low: 'default',
  normal: 'blue',
  high: 'orange',
  urgent: 'red',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'default',
  in_progress: 'processing',
  completed: 'success',
  cancelled: 'error',
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [monthFilter, setMonthFilter] = useState(dayjs().format('YYYY-MM'))
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)

  // 创建/编辑事件弹窗
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [form] = Form.useForm()

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const monthStart = dayjs(monthFilter).startOf('month').format('YYYY-MM-DD')
      const monthEnd = dayjs(monthFilter).endOf('month').format('YYYY-MM-DD')
      const res = await calendarApi.listEvents({
        start_date: monthStart,
        end_date: monthEnd,
        event_type: typeFilter,
      })
      setEvents(res.data || [])
    } catch (e) {
      message.error('加载日历事件失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [monthFilter, typeFilter])

  const openDetail = (evt: CalendarEvent) => {
    setSelectedEvent(evt)
    setDrawerOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await calendarApi.deleteEvent(id)
      message.success('事件已删除')
      fetchEvents()
    } catch {
      message.error('删除失败')
    }
  }

  // 打开创建弹窗
  const openCreateModal = () => {
    setEditingEvent(null)
    form.resetFields()
    form.setFieldsValue({
      start_time: dayjs(),
      end_time: dayjs().add(1, 'hour'),
      event_type: 'task',
      priority: 'normal',
      status: 'pending',
      all_day: false,
    })
    setModalOpen(true)
  }

  // 打开编辑弹窗
  const openEditModal = (evt: CalendarEvent) => {
    setEditingEvent(evt)
    form.setFieldsValue({
      title: evt.title,
      event_type: evt.event_type,
      start_time: dayjs(evt.start_time),
      end_time: dayjs(evt.end_time),
      all_day: evt.all_day,
      description: evt.description,
      location: evt.location,
      assignee: evt.assignee,
      department: evt.department,
      status: evt.status,
      priority: evt.priority,
      related_id: evt.related_id,
      tags: evt.tags?.join(',') || '',
    })
    setModalOpen(true)
  }

  // 提交创建/编辑
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        title: values.title,
        event_type: values.event_type,
        start_time: values.start_time.format('YYYY-MM-DDTHH:mm:ss'),
        end_time: values.end_time.format('YYYY-MM-DDTHH:mm:ss'),
        all_day: values.all_day || false,
        description: values.description || '',
        location: values.location || '',
        assignee: values.assignee || '',
        department: values.department || '',
        status: values.status || 'pending',
        priority: values.priority || 'normal',
        related_id: values.related_id || '',
        tags: values.tags ? values.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      }

      if (editingEvent) {
        await calendarApi.updateEvent(editingEvent.id, payload)
        message.success('事件已更新')
      } else {
        await calendarApi.createEvent(payload)
        message.success('事件已创建')
      }
      setModalOpen(false)
      fetchEvents()
    } catch (e) {
      if (e instanceof Error) message.error(e.message)
    }
  }

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const evt of events) {
      const dateKey = dayjs(evt.start_time).format('YYYY-MM-DD')
      if (!map.has(dateKey)) map.set(dateKey, [])
      map.get(dateKey)!.push(evt)
    }
    return map
  }, [events])

  const dateCellRender = (date: Dayjs) => {
    const dateKey = date.format('YYYY-MM-DD')
    const dayEvents = eventsByDate.get(dateKey) || []
    if (dayEvents.length === 0) return null
    return (
      <ul className="list-none p-0 m-0 space-y-0.5">
        {dayEvents.slice(0, 3).map((evt) => {
          const cfg = EVENT_TYPE_CONFIG[evt.event_type] || EVENT_TYPE_CONFIG.task
          return (
            <li key={evt.id} className="truncate">
              <Tag
                color={cfg.color}
                className="cursor-pointer text-[10px] leading-tight px-1 py-0 m-0"
                style={{ fontSize: 10, lineHeight: '16px', maxWidth: '100%' }}
                onClick={() => openDetail(evt)}
              >
                {cfg.label}: {evt.title}
              </Tag>
            </li>
          )
        })}
        {dayEvents.length > 3 && (
          <li className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} 更多</li>
        )}
      </ul>
    )
  }

  const monthCellRender = (date: Dayjs) => {
    const monthKey = date.format('YYYY-MM')
    const count = events.filter((e) => dayjs(e.start_time).format('YYYY-MM') === monthKey).length
    return count > 0 ? (
      <div className="text-center">
        <Statistic value={count} suffix="项" valueStyle={{ fontSize: 18 }} />
      </div>
    ) : null
  }

  const eventTypeChartOption = useMemo(() => {
    const typeCount: Record<string, number> = {}
    for (const evt of events) {
      typeCount[evt.event_type] = (typeCount[evt.event_type] || 0) + 1
    }
    return {
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: ['40%', '65%'],
          avoidLabelOverlap: true,
          label: { show: true, fontSize: 11, formatter: '{b}: {c}' },
          data: Object.entries(typeCount).map(([key, value]) => ({
            name: EVENT_TYPE_CONFIG[key]?.label || key,
            value,
            itemStyle: { color: EVENT_TYPE_CONFIG[key]?.color || '#999' },
          })),
        },
      ],
    }
  }, [events])

  const priorityChartOption = useMemo(() => {
    const pCount: Record<string, number> = {}
    for (const evt of events) {
      pCount[evt.priority] = (pCount[evt.priority] || 0) + 1
    }
    return {
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: ['低', '普通', '高', '紧急'] },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'bar',
          data: [
            pCount.low || 0,
            pCount.normal || 0,
            pCount.high || 0,
            pCount.urgent || 0,
          ],
          itemStyle: {
            color: (params: { dataIndex: number }) =>
              ['#d9d9d9', '#1677ff', '#fa8c16', '#ff4d4f'][params.dataIndex],
          },
        },
      ],
    }
  }, [events])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <CalendarOutlined className="mr-2" />
            日历
          </Title>
          <Text type="secondary">环境监测任务调度 · 会议管理 · 执法排班</Text>
        </div>
        <Space>
          <Select
            allowClear
            placeholder="事件类型"
            style={{ width: 120 }}
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { value: 'task', label: '监测任务' },
              { value: 'meeting', label: '会议' },
              { value: 'enforcement', label: '执法' },
              { value: 'approval', label: '审批' },
              { value: 'report', label: '报告' },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新建事件
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchEvents}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Main Calendar */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-20">
            <Spin size="large" tip="加载日历..." />
          </div>
        ) : (
          <AntCalendar
            cellRender={(date, info) => {
              if (info.type === 'date') return dateCellRender(date as Dayjs)
              if (info.type === 'month') return monthCellRender(date as Dayjs)
              return null
            }}
            onPanelChange={(date) => setMonthFilter(date.format('YYYY-MM'))}
          />
        )}
      </Card>

      {/* Stats Row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="事件类型分布" size="small">
            {events.length > 0 ? (
              <ReactECharts option={eventTypeChartOption} style={{ height: 240 }} />
            ) : (
              <Empty description="暂无事件数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="优先级分布" size="small">
            {events.length > 0 ? (
              <ReactECharts option={priorityChartOption} style={{ height: 240 }} />
            ) : (
              <Empty description="暂无事件数据" />
            )}
          </Card>
        </Col>
      </Row>

      {/* Event List */}
      <Card title={<Space><FieldTimeOutlined />近期事件</Space>} size="small">
        {events.length === 0 ? (
          <Empty description="本月暂无事件" />
        ) : (
          <div className="space-y-2">
            {events.slice(0, 10).map((evt) => {
              const cfg = EVENT_TYPE_CONFIG[evt.event_type] || EVENT_TYPE_CONFIG.task
              return (
                <div
                  key={evt.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  onClick={() => openDetail(evt)}
                >
                  <Space>
                    <Tag color={cfg.color} icon={cfg.icon}>
                      {cfg.label}
                    </Tag>
                    <div>
                      <Text strong>{evt.title}</Text>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {dayjs(evt.start_time).format('MM-DD HH:mm')}
                        {!evt.all_day && ` - ${dayjs(evt.end_time).format('HH:mm')}`}
                        {evt.all_day && ' 全天'}
                        {evt.location && ` · ${evt.location}`}
                      </div>
                    </div>
                  </Space>
                  <Space>
                    <Tag color={PRIORITY_COLOR[evt.priority]}>
                      {evt.priority === 'urgent' ? '紧急' : evt.priority === 'high' ? '高' : evt.priority === 'normal' ? '普通' : '低'}
                    </Tag>
                    <Tag color={STATUS_COLOR[evt.status]}>
                      {evt.status === 'pending' ? '待办' : evt.status === 'in_progress' ? '进行中' : evt.status === 'completed' ? '已完成' : '已取消'}
                    </Tag>
                  </Space>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Event Detail Drawer */}
      <Drawer
        title={selectedEvent?.title || '事件详情'}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedEvent(null) }}
        width={480}
        extra={
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setDrawerOpen(false)
                selectedEvent && openEditModal(selectedEvent)
              }}
            >
              编辑
            </Button>
            <Popconfirm
              title="确认删除此事件？"
              onConfirm={() => selectedEvent && handleDelete(selectedEvent.id)}
            >
              <Button danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          </Space>
        }
      >
        {selectedEvent && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="类型">
              <Tag color={EVENT_TYPE_CONFIG[selectedEvent.event_type]?.color}>
                {EVENT_TYPE_CONFIG[selectedEvent.event_type]?.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="开始时间">
              {dayjs(selectedEvent.start_time).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="结束时间">
              {dayjs(selectedEvent.end_time).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            {selectedEvent.all_day && (
              <Descriptions.Item label="全天事件">是</Descriptions.Item>
            )}
            <Descriptions.Item label="状态">
              <Tag color={STATUS_COLOR[selectedEvent.status]}>
                {selectedEvent.status === 'pending' ? '待办' : selectedEvent.status === 'in_progress' ? '进行中' : selectedEvent.status === 'completed' ? '已完成' : '已取消'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="优先级">
              <Tag color={PRIORITY_COLOR[selectedEvent.priority]}>
                {selectedEvent.priority === 'urgent' ? '紧急' : selectedEvent.priority === 'high' ? '高' : selectedEvent.priority === 'normal' ? '普通' : '低'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="描述">{selectedEvent.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="地点">{selectedEvent.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="负责人">{selectedEvent.assignee || '-'}</Descriptions.Item>
            <Descriptions.Item label="部门">{selectedEvent.department || '-'}</Descriptions.Item>
            {selectedEvent.related_id && (
              <Descriptions.Item label="关联业务">{selectedEvent.related_id}</Descriptions.Item>
            )}
            <Descriptions.Item label="标签">
              {selectedEvent.tags.length > 0
                ? selectedEvent.tags.map((t) => <Tag key={t}>{t}</Tag>)
                : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* Create / Edit Modal */}
      <Modal
        title={editingEvent ? '编辑事件' : '新建事件'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={600}
        okText={editingEvent ? '保存' : '创建'}
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入事件标题' }]}>
            <Input placeholder="事件标题" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="event_type" label="类型" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'task', label: '监测任务' },
                    { value: 'meeting', label: '会议' },
                    { value: 'enforcement', label: '执法' },
                    { value: 'approval', label: '审批' },
                    { value: 'report', label: '报告' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="优先级">
                <Select
                  options={[
                    { value: 'low', label: '低' },
                    { value: 'normal', label: '普通' },
                    { value: 'high', label: '高' },
                    { value: 'urgent', label: '紧急' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="start_time" label="开始时间" rules={[{ required: true }]}>
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="end_time" label="结束时间" rules={[{ required: true }]}>
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="all_day" label="全天事件" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="状态">
                <Select
                  options={[
                    { value: 'pending', label: '待办' },
                    { value: 'in_progress', label: '进行中' },
                    { value: 'completed', label: '已完成' },
                    { value: 'cancelled', label: '已取消' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="assignee" label="负责人">
                <Input placeholder="负责人" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="department" label="部门">
                <Input placeholder="部门" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="location" label="地点">
                <Input placeholder="地点" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="事件描述" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="related_id" label="关联业务ID">
                <Input placeholder="如案件号、审批号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tags" label="标签（逗号分隔）">
                <Input placeholder="标签1,标签2" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
