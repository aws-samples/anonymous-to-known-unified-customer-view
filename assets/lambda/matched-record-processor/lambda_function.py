import json
import awswrangler as wr
import urllib.parse
import boto3
from decimal import Decimal
import os

tableName = os.environ.get('tableName')

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(tableName)



def lambda_handler(event, context):
    for record in event['Records']:
        bucket = record['s3']['bucket']['name']
        key = urllib.parse.unquote_plus(record['s3']['object']['key'], encoding='utf-8')
        try:
            df = wr.s3.read_csv(path='s3://'+bucket+'/'+key)

            with table.batch_writer() as batch:
                for index, row in df.iterrows():
                    print(json.loads(row.to_json()))
                    batch.put_item(json.loads(row.to_json(), parse_float=Decimal))
        except Exception as e:
            print(e)
            raise e
        
