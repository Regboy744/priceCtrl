import { defineStore } from 'pinia'
import type { CredentialIssueRow } from '@/features/dashboard/types'

interface WarningsState {
 credentialIssues: CredentialIssueRow[]
}

export const useWarningsStore = defineStore('warnings', {
 state: (): WarningsState => ({
  credentialIssues: [],
 }),
 actions: {
  setCredentialIssues(issues: CredentialIssueRow[]) {
   this.credentialIssues = issues
  },
  clear() {
   this.credentialIssues = []
  },
 },
})
