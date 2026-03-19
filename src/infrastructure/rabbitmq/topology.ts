import type { Channel } from 'amqplib'

export const Exchanges = {
  RESULTS: 'marketplace.parser',
  TASKS: 'tasks',
} as const

export const Queues = {
  RESULTS_PREVIEW: 'marketplace.parser.preview',
  RESULTS_DETAILED: 'marketplace.parser.detailed',

  TASKS_PREVIEW: 'tasks.preview',
  TASKS_DETAILED: 'tasks.detailed',

  TASKS_PREVIEW_DLQ: 'tasks.preview.dlq',
  TASKS_DETAILED_DLQ: 'tasks.detailed.dlq',
} as const

export const RoutingKeys = {
  TASKS_PREVIEW: 'tasks.preview',
  TASKS_DETAILED: 'tasks.detailed',
} as const

export async function assertTopology(channel: Channel): Promise<void> {
  await channel.assertExchange(Exchanges.RESULTS, 'topic', {
    durable: true,
  })

  await channel.assertExchange(Exchanges.TASKS, 'direct', {
    durable: true,
  })

  await channel.assertExchange('tasks.dlx', 'direct', {
    durable: true,
  })

  await channel.assertQueue(Queues.TASKS_PREVIEW_DLQ, {
    durable: true,
  })

  await channel.assertQueue(Queues.TASKS_DETAILED_DLQ, {
    durable: true,
  })

  await channel.bindQueue(Queues.TASKS_PREVIEW_DLQ, 'tasks.dlx', RoutingKeys.TASKS_PREVIEW)
  await channel.bindQueue(Queues.TASKS_DETAILED_DLQ, 'tasks.dlx', RoutingKeys.TASKS_DETAILED)

  await channel.assertQueue(Queues.TASKS_PREVIEW, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': 'tasks.dlx',
      'x-dead-letter-routing-key': RoutingKeys.TASKS_PREVIEW,
    },
  })

  await channel.assertQueue(Queues.TASKS_DETAILED, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': 'tasks.dlx',
      'x-dead-letter-routing-key': RoutingKeys.TASKS_DETAILED,
    },
  })

  await channel.bindQueue(Queues.TASKS_PREVIEW, Exchanges.TASKS, RoutingKeys.TASKS_PREVIEW)
  await channel.bindQueue(Queues.TASKS_DETAILED, Exchanges.TASKS, RoutingKeys.TASKS_DETAILED)

  await channel.assertQueue(Queues.RESULTS_PREVIEW, {
    durable: true,
  })

  await channel.assertQueue(Queues.RESULTS_DETAILED, {
    durable: true,
  })
}

// Add this functions to API Gateway

export async function bindResultQueues(channel: Channel, sessionId: string): Promise<void> {
  await channel.bindQueue(Queues.RESULTS_PREVIEW, Exchanges.RESULTS, sessionId)
  await channel.bindQueue(Queues.RESULTS_DETAILED, Exchanges.RESULTS, sessionId)
}

export async function unbindResultQueues(channel: Channel, sessionId: string): Promise<void> {
  await channel.unbindQueue(Queues.RESULTS_PREVIEW, Exchanges.RESULTS, sessionId)
  await channel.unbindQueue(Queues.RESULTS_DETAILED, Exchanges.RESULTS, sessionId)
}
