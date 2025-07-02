'use client'

import { useState } from 'react'
import { Smartphone, Monitor, Tablet, Trash2, CheckCircle, Clock } from 'lucide-react'
import { motion } from 'framer-motion'

interface Device {
  id: string
  name: string
  type: 'phone' | 'desktop' | 'tablet'
  lastUsed: string
  createdAt: string
}

export function RegisteredDevices() {
  const [devices, setDevices] = useState<Device[]>([
    {
      id: '1',
      name: "Harsha's MacBook Pro",
      type: 'desktop',
      lastUsed: 'Currently active',
      createdAt: '2024-01-15'
    },
    {
      id: '2',
      name: 'iPhone 15 Pro',
      type: 'phone',
      lastUsed: '2 hours ago',
      createdAt: '2024-01-10'
    }
  ])

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'phone':
        return <Smartphone className="w-5 h-5" />
      case 'tablet':
        return <Tablet className="w-5 h-5" />
      default:
        return <Monitor className="w-5 h-5" />
    }
  }

  const handleRemoveDevice = (id: string) => {
    setDevices(devices.filter(d => d.id !== id))
  }

  return (
    <div className="section-card">
      <div className="p-6 border-b border-border">
        <h2 className="text-xl font-semibold text-heading">Registered Devices</h2>
        <p className="text-sm text-muted mt-1">
          Manage devices that can access your account with passkeys
        </p>
      </div>

      <div className="divide-y divide-border">
        {devices.map((device, index) => (
          <motion.div
            key={device.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="p-6 hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                  {getDeviceIcon(device.type)}
                </div>
                <div>
                  <h3 className="font-medium text-heading flex items-center gap-2">
                    {device.name}
                    {device.lastUsed === 'Currently active' && (
                      <span className="inline-flex items-center gap-1 text-xs text-success bg-success/10 px-2 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Active
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {device.lastUsed}
                    </span>
                    <span>Added {device.createdAt}</span>
                  </div>
                </div>
              </div>
              
              {device.lastUsed !== 'Currently active' && (
                <button
                  onClick={() => handleRemoveDevice(device.id)}
                  className="p-2 text-muted hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                  aria-label="Remove device"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="p-6 bg-secondary/30">
        <button className="text-sm text-primary hover:text-primary/80 font-medium transition-colors">
          + Add another device
        </button>
      </div>
    </div>
  )
}