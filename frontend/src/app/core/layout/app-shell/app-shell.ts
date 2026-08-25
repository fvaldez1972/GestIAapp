import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppIcon } from '../../../shared/ui/app-icon/app-icon';
import { LayoutService } from '../layout.service';
import { GESTIA_NAVIGATION } from '../navigation';

@Component({
  selector: 'app-shell',
  imports: [AppIcon, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  protected readonly layout = inject(LayoutService);
  protected readonly navigation = GESTIA_NAVIGATION;
}
