<template>
 <div class="font-sans antialiased bg-background">
  <!-- Navigation -->
  <nav
   class="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border"
  >
   <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-16">
     <div class="flex items-center space-x-2">
      <div class="p-2 bg-primary rounded-lg">
       <Tag class="w-5 h-5 text-primary-foreground" />
      </div>
      <span class="text-xl font-bold text-foreground">Price Ctrl</span>
     </div>
     <div class="hidden md:flex items-center space-x-8">
      <a
       href="#services"
       class="text-muted-foreground hover:text-foreground transition-colors"
       >Services</a
      >
      <a
       href="#how-it-works"
       class="text-muted-foreground hover:text-foreground transition-colors"
       >How It Works</a
      >
      <a
       href="#benefits"
       class="text-muted-foreground hover:text-foreground transition-colors"
       >Benefits</a
      >
     </div>
     <div class="flex items-center space-x-4">
      <Button
       v-if="isAuthenticated"
       variant="outline"
       class="border-border text-foreground hover:bg-accent"
       @click="handleViewDashboard"
      >
       Go to Dashboard
       <ArrowRight class="ml-2 w-4 h-4" />
      </Button>
      <template v-else>
       <Button
        variant="ghost"
        class="text-muted-foreground hover:text-foreground"
        @click="handleLogin"
       >
        Sign In
       </Button>
       <Button
        class="bg-primary hover:bg-primary/90 text-primary-foreground"
        @click="handleGetStarted"
       >
        Get Started
       </Button>
      </template>
     </div>
    </div>
   </div>
  </nav>

  <main>
   <!-- Hero Section -->
   <section
    id="hero"
    class="relative min-h-screen flex items-center pt-16 overflow-hidden bg-linear-to-br from-secondary via-background to-primary/5"
   >
    <!-- Subtle geometric pattern -->
    <div class="absolute inset-0 bg-grid-pattern opacity-40"></div>

    <!-- Floating shapes -->
    <div
     class="absolute top-32 -left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl opacity-60 animate-float"
    ></div>
    <div
     class="absolute bottom-20 -right-20 w-96 h-96 bg-chart-2/10 rounded-full blur-3xl opacity-50 animate-float-delayed"
    ></div>

    <div class="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-20">
     <div class="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
      <!-- Copy -->
      <div class="lg:col-span-6 space-y-6 text-center lg:text-left">
       <Badge
        variant="outline"
        class="border-primary/30 text-primary bg-primary/5"
       >
        <Sparkles class="w-3 h-3 mr-1" />
        Technology + Expertise for Smarter Retail
       </Badge>

       <h1
        class="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight tracking-tight"
       >
        Take control of your
        <span
         class="text-transparent bg-clip-text bg-linear-to-r from-primary to-chart-2"
        >
         retail operations
        </span>
       </h1>

       <p
        class="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed"
       >
        Cut costs, automate paperwork, and see every store at a glance. One
        platform + expert consulting, built for retail teams.
       </p>

       <div class="flex flex-col sm:flex-row gap-3 pt-2 justify-center lg:justify-start">
        <Button
         size="lg"
         class="bg-primary hover:bg-primary/90 text-primary-foreground group rounded-xl px-8"
         @click="scrollToSection('services')"
        >
         Explore Platform
         <ArrowRight
          class="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform"
         />
        </Button>

        <Button
         size="lg"
         variant="outline"
         class="border-border text-foreground hover:bg-accent rounded-xl px-8"
         @click="scrollToSection('cta')"
        >
         <MessageCircle class="mr-2 w-4 h-4" />
         Talk to an Expert
        </Button>
       </div>

       <!-- Trust indicators -->
       <div
        class="pt-4 flex flex-wrap gap-x-6 gap-y-2 text-muted-foreground text-sm justify-center lg:justify-start"
       >
        <div class="flex items-center gap-2">
         <CheckCircle2 class="w-4 h-4 text-success" />
         <span>No setup fees</span>
        </div>
        <div class="flex items-center gap-2">
         <CheckCircle2 class="w-4 h-4 text-success" />
         <span>14-day free trial</span>
        </div>
        <div class="flex items-center gap-2">
         <CheckCircle2 class="w-4 h-4 text-success" />
         <span>Cancel anytime</span>
        </div>
       </div>
      </div>

      <!-- Dashboard preview sketch -->
      <div class="lg:col-span-6 relative">
       <!-- Glow behind preview -->
       <div
        class="absolute -inset-4 bg-linear-to-br from-primary/20 to-chart-2/20 rounded-3xl blur-2xl opacity-60"
       ></div>

       <div
        class="relative rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
       >
        <!-- Window chrome -->
        <div
         class="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/50"
        >
         <div class="flex gap-1.5">
          <div class="w-2.5 h-2.5 rounded-full bg-destructive/60"></div>
          <div class="w-2.5 h-2.5 rounded-full bg-warning/60"></div>
          <div class="w-2.5 h-2.5 rounded-full bg-success/60"></div>
         </div>
         <div
          class="flex-1 text-center text-xs text-muted-foreground font-mono"
         >
          retailctrl.com/app/price-check
         </div>
        </div>

        <!-- Preview body -->
        <div class="p-5 space-y-4">
         <!-- Header row -->
         <div class="flex items-center justify-between">
          <div class="space-y-1">
           <div class="text-sm font-semibold text-foreground">
            Price Check · Weekly Order
           </div>
           <div class="text-xs text-muted-foreground">
            4 suppliers · 128 products
           </div>
          </div>
          <Badge class="bg-success/10 text-success border-success/20">
           Live
          </Badge>
         </div>

         <!-- KPI tiles -->
         <div class="grid grid-cols-3 gap-3">
          <div class="rounded-lg border border-border bg-background p-3">
           <div class="text-xs text-muted-foreground">Best price</div>
           <div class="text-lg font-bold text-success">€2,184</div>
           <div class="text-[10px] text-success flex items-center gap-1">
            <ArrowDown class="w-3 h-3" /> 12% vs last week
           </div>
          </div>
          <div class="rounded-lg border border-border bg-background p-3">
           <div class="text-xs text-muted-foreground">Savings</div>
           <div class="text-lg font-bold text-foreground">€316</div>
           <div class="text-[10px] text-muted-foreground">vs worst split</div>
          </div>
          <div class="rounded-lg border border-border bg-background p-3">
           <div class="text-xs text-muted-foreground">Out of stock</div>
           <div class="text-lg font-bold text-foreground">7</div>
           <div class="text-[10px] text-warning flex items-center gap-1">
            <Minus class="w-3 h-3" /> needs review
           </div>
          </div>
         </div>

         <!-- Price comparison rows -->
         <div class="rounded-lg border border-border overflow-hidden">
          <div
           class="grid grid-cols-12 gap-2 px-3 py-2 bg-secondary/60 text-[10px] uppercase tracking-wide text-muted-foreground font-medium"
          >
           <div class="col-span-5">Product</div>
           <div class="col-span-2 text-right">Musgrave</div>
           <div class="col-span-2 text-right">Barry</div>
           <div class="col-span-2 text-right">O'Reillys</div>
           <div class="col-span-1"></div>
          </div>
          <div
           v-for="row in previewRows"
           :key="row.name"
           class="grid grid-cols-12 gap-2 px-3 py-2.5 text-xs border-t border-border items-center"
          >
           <div class="col-span-5 text-foreground truncate">{{ row.name }}</div>
           <div
            :class="[
             'col-span-2 text-right font-mono tabular-nums',
             row.best === 'musgrave'
              ? 'text-success font-semibold'
              : 'text-muted-foreground',
            ]"
           >
            {{ row.musgrave }}
           </div>
           <div
            :class="[
             'col-span-2 text-right font-mono tabular-nums',
             row.best === 'barry'
              ? 'text-success font-semibold'
              : 'text-muted-foreground',
            ]"
           >
            {{ row.barry }}
           </div>
           <div
            :class="[
             'col-span-2 text-right font-mono tabular-nums',
             row.best === 'oreillys'
              ? 'text-success font-semibold'
              : 'text-muted-foreground',
            ]"
           >
            {{ row.oreillys }}
           </div>
           <div class="col-span-1 flex justify-end">
            <ArrowUp v-if="row.trend === 'up'" class="w-3 h-3 text-destructive" />
            <ArrowDown v-else-if="row.trend === 'down'" class="w-3 h-3 text-success" />
            <Minus v-else class="w-3 h-3 text-muted-foreground" />
           </div>
          </div>
         </div>

         <!-- Footer CTA row -->
         <div
          class="flex items-center justify-between pt-2 text-xs text-muted-foreground"
         >
          <span class="flex items-center gap-1.5">
           <span class="w-2 h-2 rounded-full bg-success animate-pulse"></span>
           Updated 2 minutes ago
          </span>
          <span class="text-primary font-medium">Export order →</span>
         </div>
        </div>
       </div>
      </div>
     </div>
    </div>

    <!-- Scroll indicator -->
    <div
     class="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce hidden md:block"
    >
     <ChevronDown class="w-6 h-6 text-muted-foreground" />
    </div>
   </section>

   <!-- Problem/Solution Section -->
   <section id="problem" class="py-24 bg-secondary">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
     <div class="max-w-3xl mx-auto text-center mb-16">
      <h2 class="text-3xl md:text-4xl font-bold text-foreground mb-4">
       Running a Retail Business Shouldn't Be This Hard
      </h2>
      <p class="text-lg text-muted-foreground">
       We understand the challenges you face every day
      </p>
     </div>

     <div class="grid md:grid-cols-3 gap-8 mb-16">
      <Card
       v-for="problem in problems"
       :key="problem.title"
       class="border-border bg-background shadow-sm hover:shadow-md transition-shadow"
      >
       <CardContent class="p-6">
        <div
         class="w-12 h-12 bg-destructive/10 rounded-xl flex items-center justify-center mb-4"
        >
         <component :is="problem.icon" class="w-6 h-6 text-destructive" />
        </div>
        <h3 class="text-lg font-semibold text-foreground mb-2">
         {{ problem.title }}
        </h3>
        <p class="text-muted-foreground">{{ problem.description }}</p>
       </CardContent>
      </Card>
     </div>

     <div class="text-center">
      <div
       class="inline-flex items-center gap-3 bg-primary text-primary-foreground px-8 py-4 rounded-2xl"
      >
       <Lightbulb class="w-6 h-6" />
       <span class="text-lg font-medium"
        >Price Ctrl is your unified solution for operations excellence</span
       >
      </div>
     </div>
    </div>
   </section>

   <!-- Services Section -->
   <section id="services" class="py-24 bg-background">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
     <div class="max-w-3xl mx-auto text-center mb-16">
      <h2 class="text-3xl md:text-4xl font-bold text-foreground mb-4">
       Everything You Need to Succeed
      </h2>
      <p class="text-lg text-muted-foreground">
       A powerful platform combined with expert consulting services
      </p>
     </div>

     <!-- Platform Features -->
     <div class="mb-20">
      <div class="flex items-center gap-3 mb-8">
       <div class="p-2 bg-primary/10 rounded-lg">
        <Monitor class="w-5 h-5 text-primary" />
       </div>
       <h3 class="text-2xl font-bold text-foreground">Platform Features</h3>
       <Badge class="bg-primary/10 text-primary">The App</Badge>
      </div>

      <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
       <Card
        v-for="feature in platformFeatures"
        :key="feature.title"
        class="border-border bg-linear-to-br from-card to-secondary hover:shadow-lg transition-all duration-300 group"
       >
        <CardContent class="p-6">
         <div
          class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary transition-colors"
         >
          <component
           :is="feature.icon"
           class="w-6 h-6 text-primary group-hover:text-primary-foreground transition-colors"
          />
         </div>
         <h4 class="text-lg font-semibold text-foreground mb-2">
          {{ feature.title }}
         </h4>
         <p class="text-muted-foreground text-sm mb-3">
          {{ feature.description }}
         </p>
         <p class="text-primary text-sm font-medium">{{ feature.benefit }}</p>
        </CardContent>
       </Card>
      </div>
     </div>

     <!-- Consulting Services -->
     <div>
      <div class="flex items-center gap-3 mb-8">
       <div class="p-2 bg-chart-2/10 rounded-lg">
        <Users class="w-5 h-5 text-chart-2" />
       </div>
       <h3 class="text-2xl font-bold text-foreground">Consulting Services</h3>
       <Badge class="bg-chart-2/10 text-chart-2">Expert Services</Badge>
      </div>

      <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
       <Card
        v-for="service in consultingServices"
        :key="service.title"
        class="border-border bg-linear-to-br from-card to-secondary hover:shadow-lg transition-all duration-300 group"
       >
        <CardContent class="p-6">
         <div
          class="w-12 h-12 bg-chart-2/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-chart-2 transition-colors"
         >
          <component
           :is="service.icon"
           class="w-6 h-6 text-chart-2 group-hover:text-primary-foreground transition-colors"
          />
         </div>
         <h4 class="text-lg font-semibold text-foreground mb-2">
          {{ service.title }}
         </h4>
         <p class="text-muted-foreground text-sm mb-3">
          {{ service.description }}
         </p>
         <p class="text-chart-2 text-sm font-medium">{{ service.benefit }}</p>
        </CardContent>
       </Card>
      </div>
     </div>
    </div>
   </section>

   <!-- How It Works Section -->
   <section id="how-it-works" class="py-24 bg-foreground">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
     <div class="max-w-3xl mx-auto text-center mb-16">
      <h2 class="text-3xl md:text-4xl font-bold text-background mb-4">
       How It Works
      </h2>
      <p class="text-lg text-muted-foreground">
       A simple process to transform your operations
      </p>
     </div>

     <div class="grid md:grid-cols-4 gap-8">
      <div v-for="(step, index) in steps" :key="step.title" class="relative">
       <div class="text-center">
        <div
         class="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 relative"
        >
         <component :is="step.icon" class="w-8 h-8 text-primary-foreground" />
         <div
          class="absolute -top-2 -right-2 w-6 h-6 bg-chart-2 rounded-full flex items-center justify-center text-foreground font-bold text-sm"
         >
          {{ index + 1 }}
         </div>
        </div>
        <h3 class="text-xl font-semibold text-background mb-2">
         {{ step.title }}
        </h3>
        <p class="text-muted-foreground">{{ step.description }}</p>
       </div>
       <!-- Connector line -->
       <div
        v-if="index < steps.length - 1"
        class="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-linear-to-r from-primary to-chart-2"
       ></div>
      </div>
     </div>
    </div>
   </section>

   <!-- Benefits Section -->
   <section id="benefits" class="py-24 bg-background">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
     <div class="max-w-3xl mx-auto text-center mb-16">
      <h2 class="text-3xl md:text-4xl font-bold text-foreground mb-4">
       Real Results for Real Businesses
      </h2>
      <p class="text-lg text-muted-foreground">
       See the impact Price Ctrl can have on your operations
      </p>
     </div>

     <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
      <div v-for="benefit in benefits" :key="benefit.title" class="text-center">
       <div class="text-5xl font-bold text-primary mb-2">
        {{ benefit.value }}
       </div>
       <div class="text-lg font-semibold text-foreground mb-1">
        {{ benefit.title }}
       </div>
       <div class="text-muted-foreground text-sm">
        {{ benefit.description }}
       </div>
      </div>
     </div>
    </div>
   </section>

   <!-- Testimonials Section -->
   <section id="testimonials" class="py-24 bg-secondary">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
     <div class="max-w-3xl mx-auto text-center mb-16">
      <h2 class="text-3xl md:text-4xl font-bold text-foreground mb-4">
       Trusted by Retail Businesses
      </h2>
      <p class="text-lg text-muted-foreground">
       See what our clients have to say
      </p>
     </div>

     <div class="grid md:grid-cols-3 gap-8 mb-16">
      <Card
       v-for="testimonial in testimonials"
       :key="testimonial.name"
       class="border-border bg-background"
      >
       <CardContent class="p-6">
        <div class="flex gap-1 mb-4">
         <Star
          v-for="i in 5"
          :key="i"
          class="w-5 h-5 text-warning fill-warning"
         />
        </div>
        <p class="text-muted-foreground mb-6 italic">
         "{{ testimonial.quote }}"
        </p>
        <div class="flex items-center gap-3">
         <div
          class="w-10 h-10 bg-secondary rounded-full flex items-center justify-center"
         >
          <User class="w-5 h-5 text-muted-foreground" />
         </div>
         <div>
          <div class="font-semibold text-foreground">
           {{ testimonial.name }}
          </div>
          <div class="text-sm text-muted-foreground">
           {{ testimonial.role }}
          </div>
         </div>
        </div>
       </CardContent>
      </Card>
     </div>

     <!-- Trust line -->
     <div class="text-center">
      <p class="text-muted-foreground text-sm">
       Trusted by independent retailers, franchise groups, and multi-store operators across Ireland.
      </p>
     </div>
    </div>
   </section>

   <!-- CTA Section -->
   <section id="cta" class="py-24 bg-linear-to-br from-primary to-primary/90">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
     <div class="max-w-3xl mx-auto text-center">
      <h2 class="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
       Ready to Take Control of Your Retail Operations?
      </h2>
      <p class="text-xl text-primary-foreground/80 mb-8">
       Join retail businesses that have transformed their operations with Retail
       CTRL
      </p>

      <div class="flex flex-col sm:flex-row gap-4 justify-center">
       <Button
        size="lg"
        class="bg-background text-primary hover:bg-primary/5 rounded-xl px-8"
        @click="handleGetStarted"
       >
        Start Free Trial
        <ArrowRight class="ml-2 w-4 h-4" />
       </Button>
       <Button
        size="lg"
        variant="outline"
        class="bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground hover:border-primary-foreground/60 rounded-xl px-8"
        @click="scrollToSection('services')"
       >
        Schedule a Demo
       </Button>
      </div>

      <p class="text-primary-foreground/70 text-sm mt-6">
       No credit card required. 14-day free trial.
      </p>
     </div>
    </div>
   </section>
  </main>

  <!-- Footer -->
  <footer class="bg-foreground py-16">
   <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid md:grid-cols-4 gap-12 mb-12">
     <!-- Company info -->
     <div class="space-y-4">
      <div class="flex items-center space-x-2">
       <div class="p-2 bg-primary rounded-lg">
        <Tag class="w-5 h-5 text-primary-foreground" />
       </div>
       <span class="text-xl font-bold text-background">Price Ctrl</span>
      </div>
      <p class="text-muted-foreground text-sm">
       Technology + Expertise for Smarter Retail Operations
      </p>
      <div class="flex gap-4">
       <a
        href="#"
        class="w-10 h-10 bg-foreground/90 rounded-lg flex items-center justify-center text-muted-foreground hover:text-background hover:bg-foreground/80 transition-colors"
       >
        <Linkedin class="w-5 h-5" />
       </a>
       <a
        href="#"
        class="w-10 h-10 bg-foreground/90 rounded-lg flex items-center justify-center text-muted-foreground hover:text-background hover:bg-foreground/80 transition-colors"
       >
        <Twitter class="w-5 h-5" />
       </a>
       <a
        href="#"
        class="w-10 h-10 bg-foreground/90 rounded-lg flex items-center justify-center text-muted-foreground hover:text-background hover:bg-foreground/80 transition-colors"
       >
        <Facebook class="w-5 h-5" />
       </a>
      </div>
     </div>

     <!-- Quick links -->
     <div>
      <h4 class="text-background font-semibold mb-4">Platform</h4>
      <ul class="space-y-2">
       <li>
        <a
         href="#"
         class="text-muted-foreground hover:text-background transition-colors text-sm"
         >OCR Invoice Processing</a
        >
       </li>
       <li>
        <a
         href="#"
         class="text-muted-foreground hover:text-background transition-colors text-sm"
         >Task Management</a
        >
       </li>
       <li>
        <a
         href="#"
         class="text-muted-foreground hover:text-background transition-colors text-sm"
         >Rota Scheduler</a
        >
       </li>
       <li>
        <a
         href="#"
         class="text-muted-foreground hover:text-background transition-colors text-sm"
         >Dashboard</a
        >
       </li>
      </ul>
     </div>

     <!-- Services -->
     <div>
      <h4 class="text-background font-semibold mb-4">Services</h4>
      <ul class="space-y-2">
       <li>
        <a
         href="#"
         class="text-muted-foreground hover:text-background transition-colors text-sm"
         >Data Analysis</a
        >
       </li>
       <li>
        <a
         href="#"
         class="text-muted-foreground hover:text-background transition-colors text-sm"
         >Cost Reduction</a
        >
       </li>
       <li>
        <a
         href="#"
         class="text-muted-foreground hover:text-background transition-colors text-sm"
         >Business Automation</a
        >
       </li>
       <li>
        <a
         href="#"
         class="text-muted-foreground hover:text-background transition-colors text-sm"
         >Consulting</a
        >
       </li>
      </ul>
     </div>

     <!-- Contact -->
     <div>
      <h4 class="text-background font-semibold mb-4">Contact</h4>
      <ul class="space-y-2">
       <li class="flex items-center gap-2 text-muted-foreground text-sm">
        <Mail class="w-4 h-4" />
        <span>hello@retailctrl.com</span>
       </li>
       <li class="flex items-center gap-2 text-muted-foreground text-sm">
        <Phone class="w-4 h-4" />
        <span>+44 20 1234 5678</span>
       </li>
       <li class="flex items-center gap-2 text-muted-foreground text-sm">
        <MapPin class="w-4 h-4" />
        <span>London, United Kingdom</span>
       </li>
      </ul>
     </div>
    </div>

    <div
     class="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4"
    >
     <p class="text-muted-foreground text-sm">
      &copy; {{ new Date().getFullYear() }} Price Ctrl. All rights reserved.
     </p>
     <div class="flex gap-6">
      <a
       href="#"
       class="text-muted-foreground hover:text-background transition-colors text-sm"
       >Privacy Policy</a
      >
      <a
       href="#"
       class="text-muted-foreground hover:text-background transition-colors text-sm"
       >Terms of Service</a
      >
     </div>
    </div>
   </div>
  </footer>
 </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
 ArrowRight,
 Tag,
 Sparkles,
 CheckCircle2,
 ChevronDown,
 MessageCircle,
 Clock,
 Eye,
 FileSpreadsheet,
 Lightbulb,
 Monitor,
 Users,
 ScanLine,
 ListTodo,
 CalendarClock,
 LayoutDashboard,
 BarChart3,
 PiggyBank,
 Cog,
 GraduationCap,
 Search,
 Settings,
 TrendingUp,
 Rocket,
 Star,
 User,
 Linkedin,
 Twitter,
 Facebook,
 Mail,
 Phone,
 MapPin,
 ArrowDown,
 ArrowUp,
 Minus,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const isAuthenticated = computed(() => authStore.isAuthenticated)

// Problem section data
const problems = [
 {
  icon: Clock,
  title: 'Manual Processes',
  description:
   'Hours wasted on data entry, paperwork, and repetitive tasks that could be automated.',
 },
 {
  icon: Eye,
  title: 'Lack of Visibility',
  description:
   "No clear view of costs, performance, or what's happening across your stores.",
 },
 {
  icon: FileSpreadsheet,
  title: 'Disconnected Tools',
  description:
   "Spreadsheets, paper notes, and multiple systems that don't talk to each other.",
 },
]

// Platform features data
const platformFeatures = [
 {
  icon: ScanLine,
  title: 'OCR Invoice Processing',
  description: 'Automatic invoice scanning and data extraction.',
  benefit: 'Turn paper into digital data in seconds',
 },
 {
  icon: ListTodo,
  title: 'Task Management',
  description: 'Assign and track tasks across teams.',
  benefit: 'Never lose track of what needs doing',
 },
 {
  icon: CalendarClock,
  title: 'Rota Scheduler',
  description: 'Employee shift scheduling made easy.',
  benefit: 'Schedule smarter, staff better',
 },
 {
  icon: LayoutDashboard,
  title: 'Operational Dashboard',
  description: 'Real-time visibility into store operations.',
  benefit: 'Track KPIs and performance at a glance',
 },
]

// Consulting services data
const consultingServices = [
 {
  icon: BarChart3,
  title: 'Data Analysis',
  description: 'Deep dive into your business data.',
  benefit: 'Unlock insights hidden in your numbers',
 },
 {
  icon: PiggyBank,
  title: 'Cost Reduction',
  description: 'Identify savings opportunities across operations.',
  benefit: "Find savings you didn't know existed",
 },
 {
  icon: Cog,
  title: 'Business Automation',
  description: 'Process mapping and automation strategy.',
  benefit: 'Work smarter, not harder',
 },
 {
  icon: GraduationCap,
  title: 'Operational Consulting',
  description: 'Best practices and staff training.',
  benefit: 'Expert guidance for your team',
 },
]

// How it works steps
const steps = [
 {
  icon: Search,
  title: 'Discover',
  description: 'We analyze your current operations and identify opportunities.',
 },
 {
  icon: Settings,
  title: 'Implement',
  description: 'Deploy the platform and customize it to your needs.',
 },
 {
  icon: TrendingUp,
  title: 'Optimize',
  description: 'Ongoing consulting to maximize your results.',
 },
 {
  icon: Rocket,
  title: 'Scale',
  description: 'Grow with confidence and complete control.',
 },
]

// Benefits data
const benefits = [
 {
  value: '75%',
  title: 'Faster Processing',
  description: 'Reduce invoice processing time',
 },
 {
  value: '30%',
  title: 'Cost Savings',
  description: 'Cut operational costs',
 },
 {
  value: '2x',
  title: 'Productivity',
  description: 'Improve team efficiency',
 },
 {
  value: '100%',
  title: 'Visibility',
  description: 'Complete operational oversight',
 },
]

// Preview table rows for the hero dashboard sketch
const previewRows = [
 {
  name: 'Tayto Cheese & Onion 45g',
  musgrave: '€0.89',
  barry: '€0.92',
  oreillys: '€0.84',
  best: 'oreillys',
  trend: 'down',
 },
 {
  name: 'Coca-Cola 330ml x 24',
  musgrave: '€14.20',
  barry: '€14.50',
  oreillys: '€14.95',
  best: 'musgrave',
  trend: 'up',
 },
 {
  name: 'Barry\'s Tea 80pk',
  musgrave: '€3.85',
  barry: '€3.60',
  oreillys: '€3.90',
  best: 'barry',
  trend: 'flat',
 },
 {
  name: 'Kerrygold Butter 227g',
  musgrave: '€2.75',
  barry: '€2.80',
  oreillys: '€2.68',
  best: 'oreillys',
  trend: 'down',
 },
]

// Testimonials data
const testimonials = [
 {
  name: 'Sarah Mitchell',
  role: 'Operations Manager, Fresh Foods Co.',
  quote:
   'Price Ctrl transformed how we manage our stores. Invoice processing that took hours now takes minutes.',
 },
 {
  name: 'James Chen',
  role: 'Owner, Urban Style Boutiques',
  quote:
   'The consulting team helped us identify savings we never knew existed. Incredible ROI in just 3 months.',
 },
 {
  name: 'Emma Williams',
  role: 'Finance Director, QuickMart',
  quote:
   'Finally, a platform that gives us real visibility into our operations. The dashboard is a game-changer.',
 },
]

const handleGetStarted = () => {
 if (isAuthenticated.value) {
  router.push('/app')
 } else {
  router.push('/auth/login')
 }
}

const handleViewDashboard = () => {
 router.push('/app')
}

const handleLogin = () => {
 router.push('/auth/login')
}

const scrollToSection = (sectionId: string) => {
 const element = document.getElementById(sectionId)
 if (element) {
  element.scrollIntoView({ behavior: 'smooth' })
 }
}
</script>

<style scoped>
.bg-grid-pattern {
 background-image:
  linear-gradient(
   to right,
   color-mix(in oklch, var(--border) 30%, transparent) 1px,
   transparent 1px
  ),
  linear-gradient(
   to bottom,
   color-mix(in oklch, var(--border) 30%, transparent) 1px,
   transparent 1px
  );
 background-size: 3rem 3rem;
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

html {
 scroll-behavior: smooth;
}
</style>
