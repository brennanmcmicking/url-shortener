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
        data = dynamo.get_item(
            TableName=TABLE_NAME,
            Key={
                'hash': {
                    'S': event["pathParameters"]["hash"]
                }
            }
        )
        if data and "Item" in data:
            print(data)
            return redirect(data['Item']['dest']['S'])
        else:
            return error(404)

    return error(404) 