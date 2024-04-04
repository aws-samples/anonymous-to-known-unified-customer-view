import json
import boto3
from decimal import Decimal
from boto3.dynamodb.conditions import Attr
import os

tableName = os.environ.get('tableName')

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(tableName)

class CustomEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)

        return json.JSONEncoder.default(self, obj)


def get_events_by_matchid(id_type,id_value):
    id_events = table.scan(FilterExpression=Attr(id_type).eq(id_value))
    if(len(id_events['Items'])>0):
        return table.scan(FilterExpression=Attr('MatchID').eq(id_events['Items'][0]['MatchID']))
    else:
        return None

def lambda_handler(event, context):

    response = None
    
    if("fp_cookie_id" in event["queryStringParameters"]):
        fp_cookie_id=event["queryStringParameters"]["fp_cookie_id"]
        response = get_events_by_matchid('fp_cookie_id',fp_cookie_id)
        
    elif ("email" in event["queryStringParameters"]):
        email=event["queryStringParameters"]["email"]
        response = get_events_by_matchid('email',email)
    
    else:
        response = "No Key Provided"
       
    body = {
            'Message': 'SUCCESS',
            'Response': response
        }
        
        
    return {
        'statusCode': 200,
        'body': json.dumps(body,cls=CustomEncoder),
        'headers': {
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
        }
    }
