import os
import json
import hashlib
from urllib.parse import urlparse

import boto3

TABLE_NAME = os.environ["TABLE_NAME"]
SHORT_API_URL = os.environ["SHORT_API_URL"]

HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
}

dynamo = boto3.client('dynamodb')


def is_valid_url(url: str) -> bool:
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except:
        return False

def error(code: int):
    return {
        "statusCode": code,
        "headers": HEADERS,
    }


def success(hash: str):
    return {
        "statusCode": 200,
        "headers": HEADERS,
        "body": json.dumps({
            "url": f'{SHORT_API_URL}/{hash}'
        })
    }

def handler(event, context):
    print(event)

    if "body" in event:
        body = json.loads(event["body"])

        if "url" in body:
            url = body["url"][:1000]
            if not is_valid_url(url):
                return error(400)
            m = hashlib.sha256()
            m.update(url.encode('ascii'))
            long = m.hexdigest()
            short = long[:5]
            
            data = dynamo.get_item(
                TableName=TABLE_NAME,
                Key={
                    'hash': {
                        'S': short
                    }
                }
            )
            if data and "Item" in data:
                # hash exists already
                return success(short)
                 
            else:
                result = dynamo.put_item(
                    TableName=TABLE_NAME,
                    Item={
                        'hash': {
                            'S': short
                        },
                        'dest': {
                            'S': url
                        },
                        'visit_counter': {
                            'N': '0'
                        }
                    }
                )
                return success(short)

    return {
        "statusCode": 200,
        "headers": HEADERS,
        "body": json.dumps(event)
    }