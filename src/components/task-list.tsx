"use client";

import { useRef, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addTask, deleteTask, updateTask } from "@/app/[gruppe]/actions";
import { cn } from "@/lib/utils";

type Task = { id: string; title: string; status: "todo" | "done"; assignee_id: string | null };
type Person = { id: string; name: string };

export function TaskList({
  slug,
  eventId,
  tasks,
  people,
  currentUserId,
}: {
  slug: string;
  eventId: string;
  tasks: Task[];
  people: Person[];
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const done = tasks.filter((t) => t.status === "done").length;

  return (
    <section className="space-y-4 rounded-3xl bg-card p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Oppgaver</h2>
        {tasks.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {done} av {tasks.length} ferdig
          </span>
        )}
      </div>

      <ul className={cn("space-y-2", pending && "opacity-70")}>
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-3 rounded-2xl bg-muted/60 p-2 pl-3">
            <input
              type="checkbox"
              aria-label={`Ferdig: ${t.title}`}
              checked={t.status === "done"}
              onChange={(e) =>
                startTransition(() =>
                  updateTask(slug, eventId, t.id, { status: e.target.checked ? "done" : "todo" }),
                )
              }
              className="size-4 accent-emerald-600"
            />
            <span className={cn("flex-1 text-sm", t.status === "done" && "text-muted-foreground line-through")}>
              {t.title}
            </span>
            <select
              aria-label="Ansvarlig"
              value={t.assignee_id ?? ""}
              onChange={(e) =>
                startTransition(() => updateTask(slug, eventId, t.id, { assignee_id: e.target.value || null }))
              }
              className="h-8 max-w-36 rounded-lg border bg-background px-2 text-xs"
            >
              <option value="">Ingen ansvarlig</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === currentUserId ? "Meg" : p.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Slett ${t.title}`}
              onClick={() => startTransition(() => deleteTask(slug, eventId, t.id))}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
        {tasks.length === 0 && <li className="text-sm text-muted-foreground">Ingen oppgaver ennå.</li>}
      </ul>

      <form
        ref={formRef}
        action={(fd) =>
          startTransition(async () => {
            await addTask(slug, eventId, fd);
            formRef.current?.reset();
          })
        }
        className="flex flex-wrap gap-2"
      >
        <Input name="title" placeholder="Ny oppgave, f.eks. «Ta med grill»" className="h-9 min-w-48 flex-1" required />
        <select name="assignee" aria-label="Ansvarlig" className="h-9 rounded-lg border bg-background px-2 text-sm">
          <option value="">Ingen ansvarlig</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id === currentUserId ? "Meg" : p.name}
            </option>
          ))}
        </select>
        <Button type="submit" className="h-9" disabled={pending}>
          Legg til
        </Button>
      </form>
    </section>
  );
}
