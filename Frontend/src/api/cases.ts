import api from './index'

export const listCaseFiles = () => api.get('/api/cases/casefiles/')
export const createCaseFile = (payload: any) => api.post('/api/cases/casefiles/', payload)
export const listIncidents = () => api.get('/api/cases/incidents/')
export const createIncident = (payload: any) => api.post('/api/cases/incidents/', payload)

export default {
  listCaseFiles,
  createCaseFile,
  listIncidents,
  createIncident,
}
