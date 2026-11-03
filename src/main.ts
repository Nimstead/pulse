import { mount } from 'svelte'
import App from './App.svelte'
// fonts are bundled, not loaded from Google, so the page talks to no other origin (see the CSP in index.html)
import '@fontsource-variable/archivo/wght.css'
import '@fontsource-variable/geist-mono/wght.css'
import './app.css'

mount(App, { target: document.getElementById('app')! })
