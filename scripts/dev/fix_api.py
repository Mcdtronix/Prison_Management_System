import re

with open("Frontend/src/lib/api.ts", "r") as f:
    content = f.read()

content = content.replace("""  approveAdmission: async (id: string) => {
    return fetchApi(`/reception/inmates/${id}/approve_admission/`, {
      method: 'POST',
    });
  },
  approveDischarge: async (id: string) => {
    return fetchApi(`/reception/inmates/${id}/approve_discharge/`, {
      method: 'POST',
    });
  },""", """  approveInmate: async (id: string) => {
    return fetchApi(`/reception/inmates/${id}/approve_admission/`, {
      method: "POST",
    });
  },""")

with open("Frontend/src/lib/api.ts", "w") as f:
    f.write(content)
