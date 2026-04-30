'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Plus, Trash2 } from 'lucide-react'
import { createSharedTodo, deleteTodo, toggleTodo } from '@/actions/todo'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type UserTodoItem = {
  id: string
  title: string
  done: boolean
  ownerName: string
  isOwner: boolean
  sharedWithNames: string[]
}

export function UserTodoBoard({
  initialTodos,
  shareTargets,
}: {
  initialTodos: UserTodoItem[]
  shareTargets: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [selectedShareUserIds, setSelectedShareUserIds] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const openCount = useMemo(() => initialTodos.filter((t) => !t.done).length, [initialTodos])

  function onCreate() {
    setError(null)
    startTransition(async () => {
      try {
        await createSharedTodo({ title, sharedWithUserIds: selectedShareUserIds })
        setTitle('')
        setSelectedShareUserIds([])
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Todo konnte nicht erstellt werden.')
      }
    })
  }

  function onToggle(todoId: string, done: boolean) {
    setError(null)
    startTransition(async () => {
      try {
        await toggleTodo(todoId, done)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Todo konnte nicht geändert werden.')
      }
    })
  }

  function onDelete(todoId: string) {
    setError(null)
    startTransition(async () => {
      try {
        await deleteTodo(todoId)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Todo konnte nicht gelöscht werden.')
      }
    })
  }

  return (
    <Card className="rounded-2xl border border-border/70 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Meine To-dos</h3>
        <span className="text-xs text-muted-foreground">{openCount} offen</span>
      </div>
      <div className="mb-3 flex gap-2">
        <Input
          placeholder="Neues To-do..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
          disabled={isPending}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCreate()
          }}
        />
        <Button type="button" size="icon" onClick={onCreate} disabled={isPending || !title.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {shareTargets.map((target) => {
          const active = selectedShareUserIds.includes(target.id)
          return (
            <button
              key={target.id}
              type="button"
              onClick={() =>
                setSelectedShareUserIds((prev) =>
                  prev.includes(target.id) ? prev.filter((id) => id !== target.id) : [...prev, target.id]
                )
              }
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs transition-colors',
                active
                  ? 'border-emerald-600/70 bg-emerald-100 text-emerald-800 dark:border-emerald-500/70 dark:bg-emerald-900/30 dark:text-emerald-200'
                  : 'border-border/70 bg-muted/40 text-muted-foreground hover:bg-muted'
              )}
              disabled={isPending}
            >
              {target.name}
            </button>
          )
        })}
      </div>
      {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}
      <ul className="space-y-1">
        {initialTodos.length === 0 ? (
          <li className="rounded-md px-2 py-3 text-sm text-muted-foreground">Noch keine To-dos.</li>
        ) : (
          initialTodos.map((todo) => (
            <li
              key={todo.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/20 px-2 py-2"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => onToggle(todo.id, !todo.done)}
                disabled={isPending}
              >
                <span
                  className={cn(
                    'inline-flex h-5 w-5 items-center justify-center rounded border',
                    todo.done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-muted-foreground/40'
                  )}
                >
                  {todo.done ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                <span className={cn('truncate text-sm', todo.done && 'text-muted-foreground line-through')}>
                  {todo.title}
                </span>
                <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">
                  {todo.isOwner ? 'von mir' : `von ${todo.ownerName}`}
                </span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(todo.id)}
                disabled={isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))
        )}
      </ul>
    </Card>
  )
}
