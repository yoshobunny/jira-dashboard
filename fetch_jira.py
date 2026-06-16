import requests
import json
import base64
import os

# Config — se leen de variables de entorno (GitHub Secrets)
JIRA_URL    = "https://tecdemonterrey.atlassian.net"
EMAIL       = os.environ["JIRAM"]
API_TOKEN   = os.environ["JAT"]
PROJECT_KEY = "UGSU01"

# Auth
credentials = base64.b64encode(f"{EMAIL}:{API_TOKEN}".encode()).decode()
headers = {
    "Authorization": f"Basic {credentials}",
    "Content-Type": "application/json"
}

def get_issues():
    """Trae todos los issues del proyecto con paginación"""
    all_issues = []
    next_token = None

    while True:
        url = f"{JIRA_URL}/rest/api/3/search/jql"
        params = {
            "jql": f"project = {PROJECT_KEY} ORDER BY created DESC",
            "maxResults": 100,
            "fields": "summary,status,assignee,priority,issuetype,created,updated,parent,duedate,customfield_10015,customfield_10200"
        }

        if next_token:
            params["nextPageToken"] = next_token

        response = requests.get(url, headers=headers, params=params)
        data = response.json()

        if response.status_code != 200:
            print(f"Error {response.status_code}: {response.text}")
            break

        issues = data.get("issues", [])
        all_issues.extend(issues)
        print(f"  Descargados {len(all_issues)} issues...")

        if data.get("isLast", True):
            break

        next_token = data.get("nextPageToken")

    return all_issues

def process_issues(issues):
    """Extrae solo los campos que necesitamos para las gráficas"""
    processed = []
    for issue in issues:
        fields = issue["fields"]

        try:
            parent = fields.get("parent")
            parent_key     = parent["key"]                         if parent else None
            parent_summary = parent["fields"]["summary"]           if parent else None
            parent_type    = parent["fields"]["issuetype"]["name"] if parent else None

            print(f"Procesando issue #{len(processed)+1}: {issue['key']}")
            processed.append({
                "key":            issue["key"],
                "summary":        fields["summary"],
                "status":         fields["status"]["name"],
                "priority":       fields["priority"]["name"] if fields.get("priority") else "Sin prioridad",
                "type":           fields["issuetype"]["name"],
                "assignee":       fields["assignee"]["displayName"] if fields.get("assignee") else "Sin asignar",
                "created":        fields["created"][:10],
                "updated":        fields["updated"][:10],
                "parent_key":     parent_key,
                "parent_summary": parent_summary,
                "parent_type":    parent_type,
                "due_date": fields.get("customfield_10200") or fields.get("duedate"),
                "start_date":     fields.get("customfield_10015"),
            })
        except Exception as e:
            print(f"ERROR en {issue['key']}: {e}")
            continue
    return processed

def main():
    print(f"Conectando a Jira — proyecto {PROJECT_KEY}...")
    issues = get_issues()

    if not issues:
        print("No se encontraron issues. Verifica el PROJECT_KEY y tus permisos.")
        return

    processed = process_issues(issues)

    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(processed, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Listo — {len(processed)} issues guardados en data.json")

    # Resumen rápido en consola
    statuses = {}
    for issue in processed:
        s = issue["status"]
        statuses[s] = statuses.get(s, 0) + 1

    print("\nResumen por estatus:")
    for status, count in sorted(statuses.items(), key=lambda x: -x[1]):
        print(f"  {status}: {count}")

if __name__ == "__main__":
    main()
