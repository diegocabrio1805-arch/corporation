
import json

def audit_credits():
    # Use the absolute path to the generated output file
    file_path = r'C:\Users\DANIEL\.gemini\antigravity\brain\06e83451-225f-47a8-a110-f008ad92385a\.system_generated\steps\24140\output.txt'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)
    
    # The SQL result is often inside a 'result' string if not parsed correctly by the tool,
    # but based on the previous view_file, it was a JSON object.
    # Let's handle both.
    if isinstance(raw_data, str):
        # This shouldn't happen based on previous output, but just in case
        data = json.loads(raw_data)
    else:
        data = raw_data
        
    # The JSON structure from execute_sql is usually {"result": "[...]"} or similar
    if 'result' in data:
        # Check if 'result' is a string that needs parsing
        if isinstance(data['result'], str):
            # The result string often has headers/markdown from the tool
            # But the tool output I saw earlier was a JSON string or a JSON object
            # Let's try to extract the JSON part
            try:
                # Find the first '[' and last ']'
                start = data['result'].find('<untrusted-data')
                if start != -1:
                    # It's wrapped in untrusted data tags
                    content = data['result'].split('<untrusted-data')[1].split('>')[1].split('</untrusted-data')[0]
                    main_data = json.loads(content)
                else:
                    main_data = json.loads(data['result'])
            except:
                print("Error parsing result string")
                return
        else:
            main_data = data['result']
    else:
        main_data = data
        
    # In my specific query, I wrapped everything in an object 'audit_data'
    # main_data should be a list with one item: [{"audit_data": {...}}]
    if isinstance(main_data, list) and len(main_data) > 0:
        audit_root = main_data[0].get('audit_data', {})
    else:
        print("Missing audit_data root")
        return

    loans = audit_root.get('loans', [])
    logs = audit_root.get('logs', [])
    clients = audit_root.get('clients', [])

    logs_map = {l['loan_id']: float(l['total_paid']) for l in logs if l['loan_id']}
    client_map = {c['id']: c for c in clients}

    errors = []

    for loan in loans:
        loan_id = loan['id']
        name = loan.get('client_name', 'Unknown')
        total_amount = float(loan.get('total_amount', 0))
        status = loan.get('status', 'Unknown')
        installments = loan.get('installments', [])
        paid_logs = logs_map.get(loan_id, 0.0)

        # 1. Total vs Schedule Sum
        schedule_sum = sum(float(i.get('amount', 0)) for i in installments)
        if abs(total_amount - schedule_sum) > 1.0: # Allow for tiny float diffs
            errors.append({
                'client': name,
                'loan_id': loan_id,
                'type': 'LOAN_TOTAL_MISMATCH',
                'details': f'Total {total_amount} vs Schedule Sum {schedule_sum}'
            })

        # 2. Schedule Paid vs Logs
        schedule_paid = sum(float(i.get('paidAmount', 0)) for i in installments)
        if abs(schedule_paid - paid_logs) > 1.0:
            errors.append({
                'client': name,
                'loan_id': loan_id,
                'type': 'SCHEDULE_PAID_MISMATCH',
                'details': f'Schedule says paid {schedule_paid} vs Logs sum {paid_logs}'
            })

        # 3. Balance vs Sum Pending
        calculated_balance = total_amount - paid_logs
        pending_sum = sum(float(i.get('amount', 0)) - float(i.get('paidAmount', 0)) for i in installments)
        if abs(calculated_balance - pending_sum) > 1.0:
            errors.append({
                'client': name,
                'loan_id': loan_id,
                'type': 'BALANCE_INCONSISTENCY',
                'details': f'Calc balance {calculated_balance} vs Pending sum {pending_sum}'
            })

    # 4. Client Balance Mismatch
    # Aggregate current balances per client from loans
    client_calculated_balances = {}
    for loan in loans:
        c_id = loan['client_id']
        total_amount = float(loan.get('total_amount', 0))
        paid_logs = logs_map.get(loan['id'], 0.0)
        bal = total_amount - paid_logs
        if bal < 0: bal = 0 # Avoid negative balances for audit
        client_calculated_balances[c_id] = client_calculated_balances.get(c_id, 0) + bal

    for c_id, calc_bal in client_calculated_balances.items():
        client = client_map.get(c_id)
        if client:
            db_bal = float(client.get('current_balance', 0))
            if abs(db_bal - calc_bal) > 10.0: # Wider margin for possibly non-critical diffs
                 errors.append({
                    'client': client['name'],
                    'type': 'CLIENT_BALANCE_MISMATCH',
                    'details': f'DB balance {db_bal} vs Loan aggregate {calc_bal}'
                })

    with open(r'C:\Users\DANIEL\Desktop\cobros\audit_results.json', 'w', encoding='utf-8') as f:
        json.dump(errors, f, indent=2)

    print(f"Audit finished. Found {len(errors)} potential errors.")

if __name__ == "__main__":
    audit_credits()
