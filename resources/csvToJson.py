import csv
import json


def csv_to_json(csv_file, json_file):
    # Open the CSV file
    with open(csv_file, "r") as file:
        # Read the CSV data
        csv_data = csv.DictReader(file)

        # Convert CSV data to JSON
        json_data = json.dumps(list(csv_data), indent=4)

    # Write the JSON data to a file
    with open(json_file, "w") as file:
        file.write(json_data)


# Specify the input CSV file path
csv_file = "pop.csv"

# Specify the output JSON file path
json_file = "pop.json"

# Convert CSV to JSON
csv_to_json(csv_file, json_file)
