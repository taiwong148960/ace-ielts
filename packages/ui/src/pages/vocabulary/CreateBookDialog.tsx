/**
 * Create Book Dialog
 * Modal dialog for creating new vocabulary books with word list upload
 */

import { useState, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  BookPlus,
  Upload,
  FileText,
  X,
  Check,
  AlertCircle,
  Loader2
} from "lucide-react"
import {
  cn,
  useTranslation,
  useCreateBook,
  BOOK_COVER_COLORS,
  startImport
} from "@ace-ielts/core"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Textarea
} from "../../components"

interface CreateBookDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  onSuccess?: () => void
}

/**
 * Color picker for book cover
 */
function ColorPicker({
  value,
  onChange
}: {
  value: string
  onChange: (color: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {BOOK_COVER_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            "w-8 h-8 rounded-lg transition-all",
            color,
            value === color
              ? "ring-2 ring-primary ring-offset-2 scale-110"
              : "hover:scale-105"
          )}
          title={color}
        >
          {value === color && (
            <Check className="w-4 h-4 text-white mx-auto" />
          )}
        </button>
      ))}
    </div>
  )
}

/**
 * Word count preview
 */
function WordPreview({ words }: { words: string[] }) {
  const { t } = useTranslation()
  const displayWords = words.slice(0, 10)
  const remaining = words.length - displayWords.length

  if (words.length === 0) {
    return null
  }

  return (
    <div className="mt-3 p-3 bg-neutral-bg rounded-lg">
      <p className="text-xs text-text-secondary mb-2">
        {t("vocabulary.createBook.previewTitle", { count: words.length })}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {displayWords.map((word, index) => (
          <span
            key={index}
            className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-md"
          >
            {word}
          </span>
        ))}
        {remaining > 0 && (
          <span className="px-2 py-0.5 bg-neutral-border text-text-tertiary text-xs rounded-md">
            +{remaining} more
          </span>
        )}
      </div>
    </div>
  )
}

export function CreateBookDialog({
  open,
  onOpenChange,
  userId,
  onSuccess
}: CreateBookDialogProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [coverColor, setCoverColor] = useState<string>(
    () => BOOK_COVER_COLORS[Math.floor(Math.random() * BOOK_COVER_COLORS.length)]
  )
  const [coverText, setCoverText] = useState("")
  const [coverTextEdited, setCoverTextEdited] = useState(false)
  const [wordsText, setWordsText] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Use TanStack Query mutation hook
  const { createBook, isCreating, reset: resetMutation } = useCreateBook({
    userId,
    onSuccess: async (book) => {
      // Reset form
      resetForm()
      // Reset mutation state to ensure button is enabled for next creation
      resetMutation()
      // Close dialog and notify parent
      onOpenChange(false)
      onSuccess?.()
      
      // Start import task asynchronously (don't await to avoid blocking UI)
      if (book.id && userId) {
        startImport(book.id, userId).catch((error) => {
          console.error("Failed to start import task:", error)
          // Import will be retryable from the book list page
        })
      }
    },
    onError: (err) => {
      console.error("Error creating book:", err)
      setError(t("vocabulary.createBook.errors.createFailed"))
    }
  })

  // Parse words from text (one word per line)
  const parseWords = useCallback((text: string): string[] => {
    return text
      .split(/[\n\r]+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      // Remove duplicates
      .filter((word, index, self) => 
        self.findIndex(w => w.toLowerCase() === word.toLowerCase()) === index
      )
  }, [])

  const parsedWords = parseWords(wordsText)

  // Reset form state
  const resetForm = () => {
    setName("")
    setDescription("")
    setCoverColor(
      BOOK_COVER_COLORS[Math.floor(Math.random() * BOOK_COVER_COLORS.length)]
    )
    setCoverText("")
    setWordsText("")
    setCoverTextEdited(false)
    setError(null)
  }

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file type
    if (!file.name.endsWith(".txt") && file.type !== "text/plain") {
      setError(t("vocabulary.createBook.errors.invalidFileType"))
      return
    }

    if (file.size > 1024 * 100) {
      setError(t("vocabulary.createBook.errors.fileTooLarge"))
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setWordsText(content)
      setError(null)
    }
    reader.onerror = () => {
      setError(t("vocabulary.createBook.errors.readError"))
    }
    reader.readAsText(file)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [t])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!name.trim()) {
      setError(t("vocabulary.createBook.errors.nameRequired"))
      return
    }

    if (parsedWords.length === 0) {
      setError(t("vocabulary.createBook.errors.wordsRequired"))
      return
    }

    if (parsedWords.length > 10000) {
      setError(t("vocabulary.createBook.errors.tooManyWords"))
      return
    }

    await createBook({
      name: name.trim(),
      description: description.trim() || undefined,
      cover_color: coverColor,
      cover_text: coverText.trim() || undefined,
      book_type: "custom",
      words: parsedWords
    })
  }

  // Reset form when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm()
      // Reset mutation state when closing dialog
      resetMutation()
    } else {
      setCoverColor(
        BOOK_COVER_COLORS[Math.floor(Math.random() * BOOK_COVER_COLORS.length)]
      )
      setCoverTextEdited(false)
      if (!name.trim()) setCoverText("")
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookPlus className="h-5 w-5 text-primary" />
            {t("vocabulary.createBook.title")}
          </DialogTitle>
          <DialogDescription>
            {t("vocabulary.createBook.description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Book Name */}
          <div className="space-y-2">
            <Label htmlFor="book-name" required>
              {t("vocabulary.createBook.nameLabel")}
            </Label>
            <Input
              id="book-name"
              value={name}
              onChange={(e) => {
                const v = e.target.value
                setName(v)
                if (!coverTextEdited) {
                  setCoverText(v)
                }
              }}
              placeholder={t("vocabulary.createBook.namePlaceholder")}
              maxLength={100}
              disabled={isCreating}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="book-description">
              {t("vocabulary.createBook.descriptionLabel")}
            </Label>
            <Input
              id="book-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("vocabulary.createBook.descriptionPlaceholder")}
              maxLength={200}
              disabled={isCreating}
            />
          </div>

          {/* Cover Text */}
          <div className="space-y-2">
            <Label htmlFor="cover-text">
              {t("vocabulary.createBook.coverTextLabel")}
            </Label>
            <Input
              id="cover-text"
              value={coverText}
              onChange={(e) => {
                setCoverText(e.target.value)
                setCoverTextEdited(true)
              }}
              placeholder={t("vocabulary.createBook.coverTextPlaceholder")}
              maxLength={100}
              disabled={isCreating}
              className="font-medium italic"
            />
          </div>

          {/* Cover Color */}
          <div className="space-y-2">
            <Label>{t("vocabulary.createBook.coverColorLabel")}</Label>
            <ColorPicker value={coverColor} onChange={setCoverColor} />
          </div>

          {/* Word List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="words" required>
                {t("vocabulary.createBook.wordsLabel")}
              </Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isCreating}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {t("vocabulary.createBook.uploadFile")}
                </Button>
              </div>
            </div>
            <Textarea
              id="words"
              value={wordsText}
              onChange={(e) => setWordsText(e.target.value)}
              placeholder={t("vocabulary.createBook.wordsPlaceholder")}
              className="min-h-[150px] font-mono text-sm"
              disabled={isCreating}
            />
            <p className="text-xs text-text-tertiary flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {t("vocabulary.createBook.wordsHint")}
            </p>
            <WordPreview words={parsedWords} />
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm"
              >
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="ml-auto hover:bg-red-100 rounded p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCreating}
            >
              {t("vocabulary.createBook.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={
                isCreating ||
                !name.trim() ||
                parsedWords.length === 0 ||
                parsedWords.length > 10000
              }
              className="gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("vocabulary.createBook.creating")}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {t("vocabulary.createBook.create")}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CreateBookDialog
