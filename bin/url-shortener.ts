#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { UrlShortenerStack } from '../lib/url-shortener-stack';

const app = new cdk.App();
new UrlShortenerStack(app, 'UrlShortenerStack-dev', {
  env: { account: '446708209687', region: 'us-west-2' },
  description: 'dev',
});