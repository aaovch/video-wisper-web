import { createAgent } from '@ui-sdk/svelte/agent';
import { mount } from 'svelte';
import Harness from './Harness.svelte';
import '../../../src/app.css';

Object.assign(window, { uiSdkAgent: createAgent() });
mount(Harness, { target: document.getElementById('app')! });
