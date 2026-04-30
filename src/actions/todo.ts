'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { requireSessionUser } from '@/lib/session'

const TODO_TITLE_MAX = 160

export async function createTodo(title: string) {
  const user = await requireSessionUser()
  const value = title.trim()
  if (!value) {
    throw new Error('Bitte einen Titel eingeben.')
  }
  await prisma.todo.create({
    data: {
      userId: user.id,
      title: value.slice(0, TODO_TITLE_MAX),
    },
  })
  revalidatePath('/')
}

export async function createSharedTodo(input: { title: string; sharedWithUserIds: string[] }) {
  const user = await requireSessionUser()
  const value = input.title.trim()
  if (!value) {
    throw new Error('Bitte einen Titel eingeben.')
  }
  const shareIds = Array.from(new Set(input.sharedWithUserIds.map((v) => v.trim()).filter(Boolean))).filter(
    (id) => id !== user.id
  )
  const existingUsers = shareIds.length
    ? await prisma.user.findMany({ where: { id: { in: shareIds } }, select: { id: true } })
    : []
  const validIds = new Set(existingUsers.map((u) => u.id))
  await prisma.todo.create({
    data: {
      userId: user.id,
      title: value.slice(0, TODO_TITLE_MAX),
      shares: {
        create: shareIds.filter((id) => validIds.has(id)).map((id) => ({ userId: id })),
      },
    },
  })
  revalidatePath('/')
}

export async function toggleTodo(todoId: string, done: boolean) {
  const user = await requireSessionUser()
  const row = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { id: true, userId: true, shares: { where: { userId: user.id }, select: { id: true } } },
  })
  if (!row || (row.userId !== user.id && row.shares.length === 0)) {
    throw new Error('Todo nicht gefunden.')
  }
  await prisma.todo.update({
    where: { id: row.id },
    data: { done },
  })
  revalidatePath('/')
}

export async function deleteTodo(todoId: string) {
  const user = await requireSessionUser()
  const row = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { id: true, userId: true },
  })
  if (!row) {
    throw new Error('Todo nicht gefunden.')
  }
  if (row.userId !== user.id) {
    await prisma.todoShare.deleteMany({
      where: {
        todoId: row.id,
        userId: user.id,
      },
    })
    revalidatePath('/')
    return
  }
  await prisma.todo.delete({ where: { id: row.id } })
  revalidatePath('/')
}
