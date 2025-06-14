'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Building, Briefcase, Globe, MapPin, Calendar } from 'lucide-react'
import type { ApplicationStatus } from '@/types'

interface QuickAddModalProps {
  onAdd: (applicationData: QuickAddFormData) => Promise<void>
  isLoading?: boolean
}

export interface QuickAddFormData {
  company: string
  role: string
  jobPostingUrl?: string
  location?: string
  workType: 'remote' | 'hybrid' | 'onsite'
  salaryRange?: string
  notes?: string
  status: ApplicationStatus
}

export function QuickAddModal({ onAdd, isLoading = false }: QuickAddModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showMoreFields, setShowMoreFields] = useState(false)
  const [formData, setFormData] = useState<QuickAddFormData>({
    company: '',
    role: '',
    jobPostingUrl: '',
    location: '',
    workType: 'onsite',
    salaryRange: '',
    notes: '',
    status: 'applied'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.company.trim() || !formData.role.trim()) {
      return
    }

    try {
      await onAdd(formData)
      
      // Reset form and close modal
      setFormData({
        company: '',
        role: '',
        jobPostingUrl: '',
        location: '',
        workType: 'onsite',
        salaryRange: '',
        notes: '',
        status: 'applied'
      })
      setShowMoreFields(false)
      setIsOpen(false)
    } catch (error) {
      console.error('Failed to add application:', error)
    }
  }

  const updateFormData = (field: keyof QuickAddFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Application
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Application
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Essential Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Company *
              </Label>
              <Input
                id="company"
                placeholder="e.g. Google, Microsoft, Startup Inc."
                value={formData.company}
                onChange={(e) => updateFormData('company', e.target.value)}
                required
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Role *
              </Label>
              <Input
                id="role"
                placeholder="e.g. Senior Software Engineer, Product Manager"
                value={formData.role}
                onChange={(e) => updateFormData('role', e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="jobUrl" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Job Posting URL
              </Label>
              <Input
                id="jobUrl"
                type="url"
                placeholder="https://company.com/careers/job-123"
                value={formData.jobPostingUrl}
                onChange={(e) => updateFormData('jobPostingUrl', e.target.value)}
              />
            </div>
          </div>

          {/* More Details Toggle */}
          {!showMoreFields && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowMoreFields(true)}
              className="text-blue-600 hover:text-blue-700"
            >
              + Add More Details
            </Button>
          )}

          {/* Additional Fields */}
          {showMoreFields && (
            <div className="space-y-4 pt-2 border-t">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="location" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </Label>
                  <Input
                    id="location"
                    placeholder="San Francisco, CA"
                    value={formData.location}
                    onChange={(e) => updateFormData('location', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="workType">Work Type</Label>
                  <Select
                    value={formData.workType}
                    onValueChange={(value: 'remote' | 'hybrid' | 'onsite') => updateFormData('workType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="onsite">Onsite</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                      <SelectItem value="remote">Remote</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="salary">Salary Range</Label>
                <Input
                  id="salary"
                  placeholder="e.g. $120K - $150K, $80-100K"
                  value={formData.salaryRange}
                  onChange={(e) => updateFormData('salaryRange', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes about this application..."
                  value={formData.notes}
                  onChange={(e) => updateFormData('notes', e.target.value)}
                  rows={2}
                />
              </div>
              
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowMoreFields(false)}
                className="text-gray-600 hover:text-gray-700"
              >
                - Show Less
              </Button>
            </div>
          )}

          {/* Submit Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!formData.company.trim() || !formData.role.trim() || isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? 'Adding...' : 'Add Application'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}