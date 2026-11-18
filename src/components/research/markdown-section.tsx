import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Edit3, Eye, Loader2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'

interface MarkdownSectionProps {
  title: string
  subtitle?: string
  value: string
  placeholder: string
  isSaving?: boolean
  onSave: (nextValue: string) => void
}

export function MarkdownSection({
  title,
  subtitle,
  value,
  placeholder,
  isSaving = false,
  onSave,
}: MarkdownSectionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function startEdit() {
    setDraft(value)
    setIsEditing(true)
  }

  function handleSave() {
    onSave(draft)
    setIsEditing(false)
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div>
          <h3 className="text-xs font-semibold tracking-tight">{title}</h3>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isEditing ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(false)}
              >
                <Eye className="h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button size="sm" disabled={isSaving} onClick={handleSave}>
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Save
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={startEdit}>
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="p-4">
        {isEditing ? (
          <Textarea
            rows={7}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="font-mono text-xs leading-relaxed"
          />
        ) : value.trim() ? (
          <div className="prose-contrib">
            <Markdown remarkPlugins={[remarkGfm]}>{value}</Markdown>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="w-full rounded-md border border-dashed border-border/80 px-3 py-5 text-left text-xs text-muted-foreground hover:border-ring/60 hover:text-foreground transition-colors cursor-pointer"
          >
            {placeholder}
          </button>
        )}
      </div>
    </div>
  )
}
