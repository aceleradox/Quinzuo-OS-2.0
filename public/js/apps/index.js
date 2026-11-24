// Importa todos os aplicativos (cada módulo registra-se no registry)
import { defineApp } from '../core/app-registry.js';
import { renderBiosForm } from '../core/bios.js';

import './cortex.js';
import './cortex-framework-app.js';
import './kernel.js';
import './terminal.js';
import './codenate.js';
import './codeneta.js';
import './code-horn.js';
import './fantasm.js';
import './qnz-runner.js';
import './qnz-designer.js';
import './qnz-builder.js';
import './pinta-clima.js';
import './makeup-editor.js';

import './floppy.js';
import './trash.js';
import './config.js';
import './notepad.js';
import './browser.js';
import './arcade.js';
import './personalizar.js';
import './office.js';
import './word.js';
import './excel.js';
import './access.js';
import './net-tools.js';

defineApp('bios', {
    render(containerId) {
        renderBiosForm(document.getElementById(containerId), {
            embedded: true,
            onBoot: () => import('../core/boot.js').then((m) => m.startBootSequence()),
            onSetup: () => import('../core/boot.js').then((m) => m.showSetup())
        });
    }
});
