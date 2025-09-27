'use client'

import { useState, useRef, DragEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Upload, File, X, AlertCircle, Check } from 'lucide-react'

interface FileUploadProps {
  onFileSelected: (file: File) => void
  maxSizeBytes?: number
  allowedTypes?: string[]
  disabled?: boolean
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getFileTypeIcon = (type: string) => {
  if (type.startsWith('image/')) return '🖼️'
  if (type.startsWith('video/')) return '🎥'
  if (type.startsWith('audio/')) return '🎵'
  if (type.includes('pdf')) return '📄'
  if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return '🗜️'
  if (type.includes('text/') || type.includes('json')) return '📝'
  return '📄'
}

export default function FileUpload({ 
  onFileSelected, 
  maxSizeBytes = 50 * 1024 * 1024, // 50MB default
  allowedTypes = [],
  disabled = false 
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    if (file.size > maxSizeBytes) {
      return `File size must be less than ${formatFileSize(maxSizeBytes)}`
    }
    
    if (allowedTypes.length > 0 && !allowedTypes.some(type => 
      file.type.includes(type) || file.name.toLowerCase().endsWith(type)
    )) {
      return `File type not allowed. Supported types: ${allowedTypes.join(', ')}`
    }
    
    return null
  }

  const handleFileSelect = (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }
    
    setError('')
    setSelectedFile(file)
    onFileSelected(file)
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    if (disabled) return
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const clearFile = () => {
    setSelectedFile(null)
    setError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const openFileDialog = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <div className="space-y-4">
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : selectedFile
            ? 'border-green-500 bg-green-50/50 dark:bg-green-900/10'
            : error
            ? 'border-destructive bg-destructive/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInputChange}
          disabled={disabled}
        />

        <AnimatePresence mode="wait">
          {selectedFile ? (
            <motion.div
              key="file-selected"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-sm font-medium">
                  <span className="text-2xl">{getFileTypeIcon(selectedFile.type)}</span>
                  <span className="text-foreground">{selectedFile.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)} • Ready to encrypt and upload
                </p>
              </div>
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  clearFile()
                }}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                <X className="w-4 h-4 mr-1" />
                Remove
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="file-upload"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-medium text-foreground">
                  {isDragging ? 'Drop your file here' : 'Upload a file'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Drag and drop a file, or{' '}
                  <span className="text-primary font-medium">click to browse</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Max size: {formatFileSize(maxSizeBytes)}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-lg text-sm flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </motion.div>
      )}

      <div className="bg-muted/30 border border-border rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <File className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-muted-foreground">
              Files are encrypted client-side before upload. The recipient will download the original file after decryption.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
