import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
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
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly layout = inject(LayoutService);
  protected readonly navigation = GESTIA_NAVIGATION;

  protected logout() {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
