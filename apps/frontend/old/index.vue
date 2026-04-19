<template>
 <section
  class="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
 >
  <!-- Animated background grid -->
  <div class="absolute inset-0 bg-grid-pattern opacity-10"></div>

  <!-- Floating geometric shapes -->
  <div
   class="absolute top-20 left-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-float"
  ></div>
  <div
   class="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-float-delayed"
  ></div>

  <div class="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
   <div class="grid lg:grid-cols-2 gap-12 items-center">
    <!-- Left content -->
    <div class="text-left space-y-8">
     <Badge variant="outline" class="border-blue-400/50 text-blue-400 w-fit">
      <Zap class="w-3 h-3 mr-1" />
      Engineering Excellence Since 2010
     </Badge>

     <div class="space-y-4">
      <h1
       class="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight"
      >
       Building the
       <span
        class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400"
       >
        Future
       </span>
       <br />
       of Engineering
      </h1>

      <p class="text-xl text-slate-300 max-w-2xl leading-relaxed">
       Innovative solutions in structural, mechanical, and electrical
       engineering. We transform complex challenges into elegant, sustainable
       designs.
      </p>
     </div>

     <div class="flex flex-col sm:flex-row gap-4">
      <Button
       size="lg"
       class="bg-blue-600 hover:bg-blue-700 text-white group"
       @click="handleGetStarted"
      >
       Get Started
       <ArrowRight
        class="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform"
       />
      </Button>

      <Button
       size="lg"
       variant="outline"
       class="border-slate-600 text-white hover:bg-slate-800"
       @click="handleViewProjects"
      >
       <Building2 class="mr-2 w-4 h-4" />
       View Projects
      </Button>
     </div>

     <!-- Stats -->
     <div class="grid grid-cols-3 gap-8 pt-8 border-t border-slate-700">
      <div v-for="stat in stats" :key="stat.label" class="space-y-1">
       <div class="text-3xl font-bold text-white">{{ stat.value }}</div>
       <div class="text-sm text-slate-400">{{ stat.label }}</div>
      </div>
     </div>
    </div>

    <!-- Right content - 3D card showcase -->
    <div class="relative lg:block hidden">
     <div class="relative">
      <!-- Main feature card -->
      <Card
       class="backdrop-blur-lg bg-slate-800/50 border-slate-700 transform hover:scale-105 transition-transform duration-300"
      >
       <CardContent class="p-8">
        <div class="space-y-6">
         <div class="flex items-center gap-4">
          <div class="p-3 bg-blue-500/10 rounded-lg">
           <Cpu class="w-8 h-8 text-blue-400" />
          </div>
          <div>
           <h3 class="text-xl font-semibold text-white">
            Advanced CAD Systems
           </h3>
           <p class="text-slate-400 text-sm">Precision engineering design</p>
          </div>
         </div>

         <div class="space-y-4">
          <div
           v-for="feature in features"
           :key="feature.name"
           class="flex items-center gap-3 p-3 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors cursor-pointer"
          >
           <component :is="feature.icon" class="w-5 h-5 text-cyan-400" />
           <div class="flex-1">
            <div class="text-white font-medium">{{ feature.name }}</div>
            <div class="text-xs text-slate-400">{{ feature.description }}</div>
           </div>
           <Badge variant="secondary" class="text-xs">{{
            feature.status
           }}</Badge>
          </div>
         </div>

         <div class="pt-4 border-t border-slate-700">
          <div class="flex items-center justify-between text-sm">
           <span class="text-slate-400">Project Success Rate</span>
           <span class="text-green-400 font-semibold">98.7%</span>
          </div>
          <div class="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
           <div
            class="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
            :style="{ width: successRate + '%' }"
           ></div>
          </div>
         </div>
        </div>
       </CardContent>
      </Card>

      <!-- Floating accent cards -->
      <Card
       class="absolute -top-8 -right-8 w-48 backdrop-blur-lg bg-slate-800/50 border-slate-700 animate-float"
      >
       <CardContent class="p-4">
        <div class="flex items-center gap-3">
         <CheckCircle2 class="w-8 h-8 text-green-400" />
         <div>
          <div class="text-2xl font-bold text-white">500+</div>
          <div class="text-xs text-slate-400">Projects Delivered</div>
         </div>
        </div>
       </CardContent>
      </Card>

      <Card
       class="absolute -bottom-6 -left-6 w-44 backdrop-blur-lg bg-slate-800/50 border-slate-700 animate-float-delayed"
      >
       <CardContent class="p-4">
        <div class="flex items-center gap-3">
         <Users class="w-8 h-8 text-blue-400" />
         <div>
          <div class="text-2xl font-bold text-white">150+</div>
          <div class="text-xs text-slate-400">Team Members</div>
         </div>
        </div>
       </CardContent>
      </Card>
     </div>
    </div>
   </div>
  </div>

  <!-- Scroll indicator -->
  <div
   class="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce"
  >
   <ChevronDown class="w-6 h-6 text-slate-400" />
  </div>
 </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
 ArrowRight,
 Building2,
 Cpu,
 Zap,
 CheckCircle2,
 Users,
 ChevronDown,
 Gauge,
 Shield,
 Layers,
} from 'lucide-vue-next'

const stats = ref([
 { value: '15+', label: 'Years Experience' },
 { value: '500+', label: 'Projects' },
 { value: '98%', label: 'Client Satisfaction' },
])

const features = ref([
 {
  name: 'Structural Analysis',
  description: 'Advanced FEA modeling',
  icon: Layers,
  status: 'Active',
 },
 {
  name: 'Performance Testing',
  description: 'Real-time simulations',
  icon: Gauge,
  status: 'Live',
 },
 {
  name: 'Safety Compliance',
  description: 'ISO certified processes',
  icon: Shield,
  status: 'Certified',
 },
])

const successRate = ref(0)

onMounted(() => {
 // Animate success rate on mount
 const target = 98.7
 const duration = 2000
 const steps = 60
 const increment = target / steps
 const interval = duration / steps

 let current = 0
 const timer = setInterval(() => {
  current += increment
  if (current >= target) {
   successRate.value = target
   clearInterval(timer)
  } else {
   successRate.value = current
  }
 }, interval)
})

const handleGetStarted = () => {
 console.log('Get Started clicked')
 // Add your navigation logic here
}

const handleViewProjects = () => {
 console.log('View Projects clicked')
 // Add your navigation logic here
}
</script>

<style scoped>
.bg-grid-pattern {
 background-image:
  linear-gradient(to right, rgba(148, 163, 184, 0.1) 1px, transparent 1px),
  linear-gradient(to bottom, rgba(148, 163, 184, 0.1) 1px, transparent 1px);
 background-size: 4rem 4rem;
}

@keyframes float {
 0%,
 100% {
  transform: translateY(0px);
 }
 50% {
  transform: translateY(-20px);
 }
}

@keyframes float-delayed {
 0%,
 100% {
  transform: translateY(0px);
 }
 50% {
  transform: translateY(-30px);
 }
}

.animate-float {
 animation: float 6s ease-in-out infinite;
}

.animate-float-delayed {
 animation: float-delayed 8s ease-in-out infinite;
 animation-delay: 1s;
}
</style>
