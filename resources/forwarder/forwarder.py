import os
import json
import base64
import datetime

import boto3

TABLE_NAME = os.environ["TABLE_NAME"]

HEADERS = {
    "Content-Type": "application/json",
    "Acces-Control-Allow-Origin": "*",
}

dynamo = boto3.client('dynamodb')

def error(code: int):
    return {
        "statusCode": code,
        "headers": HEADERS,
    }

def redirect(destination: str):
    header = HEADERS.copy()
    header["Location"] = destination
    return {
        "statusCode": 301,
        "headers": header,
    }

def handler(event, context):
    print(event)

    if "pathParameters" in event and "hash" in event["pathParameters"]:
        h = event["pathParameters"]["hash"]
        data = dynamo.get_item(
            TableName=TABLE_NAME,
            Key={
                'hash': {
                    'S': h
                }
            }
        )

        if data and "Item" in data:
            try:
                dynamo.update_item(
                    TableName=TABLE_NAME,
                    Key={
                        'hash': {
                            'S': h 
                        },
                    }, 
                    UpdateExpression='ADD visit_counter :inc',  
                    ExpressionAttributeValues={
                        ':inc': {
                            'N': '1'
                        }
                    },
                )
            except Exception as e:
                print(e)

            print(data)
            item = data['Item']
            if 'dest' in item:
                dest = item['dest']
                if 'S' in dest:
                    return redirect(dest['S'])

    return error(404) 