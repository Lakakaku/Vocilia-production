/**
 * System Resource Monitor for tracking CPU, Memory, and GPU usage
 * Used by ModelPerformanceMonitor to collect system metrics
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

const execAsync = promisify(exec);

export interface SystemResources {
  memoryUsageMB: number;
  memoryPercentage: number;
  cpuPercentage: number;
  gpuPercentage?: number;
  gpuMemoryMB?: number;
  loadAverage: number[];
  processPid: number;
  timestamp: Date;
}

export class SystemResourceMonitor {
  private intervalId?: NodeJS.Timeout;
  private isMonitoring: boolean = false;
  private lastCpuUsage?: NodeJS.CpuUsage;
  
  constructor(private monitoringIntervalMs: number = 1000) {}

  /**
   * Start continuous monitoring
   */
  start(): void {
    if (this.isMonitoring) {
      console.warn('System monitoring already started');
      return;
    }
    
    this.isMonitoring = true;
    this.intervalId = setInterval(async () => {
      try {
        const resources = await this.getCurrentResources();
        // Could emit event here for real-time monitoring
      } catch (error) {
        console.warn('Failed to collect system resources:', error);
      }
    }, this.monitoringIntervalMs);
    
    console.log(`System resource monitoring started (interval: ${this.monitoringIntervalMs}ms)`);
  }

  /**
   * Stop continuous monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    
    this.isMonitoring = false;
    console.log('System resource monitoring stopped');
  }

  /**
   * Get current system resource usage
   */
  async getCurrentResources(): Promise<SystemResources> {
    const [memoryUsage, cpuUsage] = await Promise.all([
      this.getMemoryUsage(),
      this.getCpuUsage()
    ]);
    
    let gpuUsage: { percentage?: number; memoryMB?: number } = {};
    
    try {
      gpuUsage = await this.getGpuUsage();
    } catch (error) {
      // GPU monitoring is optional, continue without it
    }
    
    return {
      memoryUsageMB: memoryUsage.usedMB,
      memoryPercentage: memoryUsage.percentage,
      cpuPercentage: cpuUsage,
      gpuPercentage: gpuUsage.percentage,
      gpuMemoryMB: gpuUsage.memoryMB,
      loadAverage: os.loadavg(),
      processPid: process.pid,
      timestamp: new Date()
    };
  }

  /**
   * Get memory usage for current process and system
   */
  private async getMemoryUsage(): Promise<{ usedMB: number; percentage: number; }> {
    const processMemory = process.memoryUsage();
    const systemMemory = {
      total: os.totalmem(),
      free: os.freemem()
    };
    
    // Process memory in MB
    const processMemoryMB = processMemory.heapUsed / (1024 * 1024);
    
    // System memory percentage
    const systemUsedMemory = systemMemory.total - systemMemory.free;
    const systemMemoryPercentage = (systemUsedMemory / systemMemory.total) * 100;
    
    return {
      usedMB: processMemoryMB,
      percentage: systemMemoryPercentage
    };
  }

  /**
   * Get CPU usage percentage
   */
  private async getCpuUsage(): Promise<number> {
    const currentUsage = process.cpuUsage();
    
    if (!this.lastCpuUsage) {
      this.lastCpuUsage = currentUsage;
      // Return system load average as estimate for first measurement
      const loadAvg = os.loadavg()[0]; // 1-minute load average
      const cpuCount = os.cpus().length;
      return Math.min(100, (loadAvg / cpuCount) * 100);
    }
    
    // Calculate CPU usage delta
    const userDelta = currentUsage.user - this.lastCpuUsage.user;
    const systemDelta = currentUsage.system - this.lastCpuUsage.system;
    const totalDelta = userDelta + systemDelta;
    
    this.lastCpuUsage = currentUsage;
    
    // Convert microseconds to percentage (rough estimate)
    // This is process-specific CPU usage
    const intervalMs = this.monitoringIntervalMs;
    const cpuPercent = (totalDelta / (intervalMs * 1000)) * 100;
    
    return Math.min(100, Math.max(0, cpuPercent));
  }

  /**
   * Get GPU usage (NVIDIA GPUs via nvidia-smi)
   */
  private async getGpuUsage(): Promise<{ percentage?: number; memoryMB?: number; }> {
    try {
      // Try NVIDIA GPU monitoring first
      const { stdout } = await execAsync('nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader,nounits', {
        timeout: 5000
      });
      
      const lines = stdout.trim().split('\n');
      if (lines.length > 0 && lines[0]) {
        const [gpuUtil, memoryUsed] = lines[0].split(',').map(s => parseInt(s.trim()));
        
        if (!isNaN(gpuUtil) && !isNaN(memoryUsed)) {
          return {
            percentage: gpuUtil,
            memoryMB: memoryUsed
          };
        }
      }
    } catch (nvidiaError) {
      // Try AMD GPU monitoring (rocm-smi)
      try {
        const { stdout } = await execAsync('rocm-smi --showuse', { timeout: 5000 });
        
        // Parse rocm-smi output (this is a simplified parser)
        const lines = stdout.split('\n');
        for (const line of lines) {
          if (line.includes('GPU use (%)')) {
            const match = line.match(/(\d+)%/);
            if (match) {
              return { percentage: parseInt(match[1]) };
            }
          }
        }
      } catch (amdError) {
        // No GPU monitoring available
      }
    }
    
    return {};
  }

  /**
   * Get system information
   */
  async getSystemInfo(): Promise<{
    platform: string;
    arch: string;
    totalMemoryGB: number;
    cpuModel: string;
    cpuCores: number;
    nodeVersion: string;
    hasGPU: boolean;
  }> {
    const cpus = os.cpus();
    let hasGPU = false;
    
    try {
      await execAsync('nvidia-smi -L', { timeout: 2000 });
      hasGPU = true;
    } catch {
      try {
        await execAsync('rocm-smi --version', { timeout: 2000 });
        hasGPU = true;
      } catch {
        hasGPU = false;
      }
    }
    
    return {
      platform: os.platform(),
      arch: os.arch(),
      totalMemoryGB: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
      cpuModel: cpus[0]?.model || 'Unknown',
      cpuCores: cpus.length,
      nodeVersion: process.version,
      hasGPU
    };
  }

  /**
   * Get process-specific resource usage
   */
  getProcessResources(): {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    uptime: number;
    pid: number;
  } {
    return {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime(),
      pid: process.pid
    };
  }

  /**
   * Check if system resources are under stress
   */
  async isSystemUnderStress(): Promise<{
    isUnderStress: boolean;
    reasons: string[];
    metrics: SystemResources;
  }> {
    const resources = await this.getCurrentResources();
    const reasons: string[] = [];
    
    // Define stress thresholds
    const thresholds = {
      memoryPercentage: 85,   // 85% system memory usage
      cpuPercentage: 80,      // 80% CPU usage
      gpuPercentage: 90,      // 90% GPU usage
      loadAverage: os.cpus().length * 1.5  // Load average > 1.5x CPU cores
    };
    
    if (resources.memoryPercentage > thresholds.memoryPercentage) {
      reasons.push(`High system memory usage: ${resources.memoryPercentage.toFixed(1)}%`);
    }
    
    if (resources.cpuPercentage > thresholds.cpuPercentage) {
      reasons.push(`High CPU usage: ${resources.cpuPercentage.toFixed(1)}%`);
    }
    
    if (resources.gpuPercentage && resources.gpuPercentage > thresholds.gpuPercentage) {
      reasons.push(`High GPU usage: ${resources.gpuPercentage.toFixed(1)}%`);
    }
    
    if (resources.loadAverage[0] > thresholds.loadAverage) {
      reasons.push(`High load average: ${resources.loadAverage[0].toFixed(2)}`);
    }
    
    return {
      isUnderStress: reasons.length > 0,
      reasons,
      metrics: resources
    };
  }
}