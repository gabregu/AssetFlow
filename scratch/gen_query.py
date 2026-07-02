import os
import sys

# Read serials from file
with open('scratch/serials_to_verify.txt', 'r') as f:
    serials = [line.strip() for line in f if line.strip()]

# Format as SQL list
sql_list = ", ".join([f"'{s}'" for s in serials])

# Prepare SQL query
query = f"SELECT serial, assignee, status FROM assets WHERE serial IN ({sql_list});"

with open('scratch/verify_query.sql', 'w') as f:
    f.write(query)

print(f"Generated query for {len(serials)} serials.")
