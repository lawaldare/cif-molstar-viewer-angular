import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements AfterViewInit {
  @ViewChild('dropArea') dropArea!: ElementRef<HTMLElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('viewer') viewer!: ElementRef<HTMLElement>;

  private plugin: any = null;
  public currentFile: File | null = null;
  public isLoading = signal(false);
  public errorMsg = signal('');
  public successMsg = signal('');

  ngAfterViewInit(): void {
    this.initMolstar();
  }

  /** Browse file button */
  public onBrowseClick(): void {
    this.fileInput.nativeElement.click();
  }

  /** File input change */
  public onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.processFile(input.files[0]);
    }
  }

  /** Drag & drop events */
  public onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dropArea.nativeElement.style.borderColor = '#2196f3';
    this.dropArea.nativeElement.style.backgroundColor =
      'rgba(33, 150, 243, 0.1)';
  }

  public onDragLeave(): void {
    this.resetDropAreaStyle();
  }

  public onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer?.files.length) {
      this.processFile(event.dataTransfer.files[0]);
    }

    this.resetDropAreaStyle();
  }

  private resetDropAreaStyle(): void {
    this.dropArea.nativeElement.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    this.dropArea.nativeElement.style.backgroundColor = 'transparent';
  }

  /** File processing */
  private processFile(file: File): void {
    if (!file.name.toLowerCase().endsWith('.cif')) {
      this.showError('Please select a valid .cif file');
      return;
    }

    this.currentFile = file;
    this.hideError();
    this.showSuccess('File selected successfully. Loading structure...');
    this.loadFileToViewer(file);
  }

  /** Molstar initialization */
  private async initMolstar() {
    try {
      this.showLoading();

      // Assumes Molstar is loaded globally
      this.plugin = await (window as any).molstar.Viewer.create(
        this.viewer.nativeElement,
        {
          layoutIsExpanded: false,
          layoutShowControls: false,
          layoutShowRemoteState: false,
          layoutShowSequence: false,
          layoutShowLog: false,
          layoutShowLeftPanel: false,
          collapseLeftPanel: true,
          collapseRightPanel: true,
          viewportShowControls: false,
          canvas3d: { backgroundColor: { r: 0, g: 0, b: 0 } },
        }
      );

      this.hideLoading();
    } catch (error) {
      console.error('Error initializing Molstar:', error);
      this.showError('Error initializing Molstar');
    }
  }

  /** Load CIF file to Molstar */
  private async loadFileToViewer(file: File): Promise<void> {
    if (!this.plugin) {
      this.showError('Viewer not initialized');
      return;
    }

    try {
      this.showLoading();
      const fileContent = await this.readFileAsText(file);
      await this.plugin.loadStructureFromData(fileContent, 'mmcif');
      this.showSuccess('Structure loaded successfully');
      this.hideLoading();
    } catch (error) {
      console.error('Error loading CIF file:', error);
      this.showError('Failed to load the CIF file. Please try another file.');
      this.hideLoading();
    }
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  /** Reset camera view */
  // private resetView(): void {
  //   if (this.plugin) {
  //     this.plugin.canvas3d().requestCameraReset();
  //   }
  // }

  /** Helpers for UI state */
  private showLoading(): void {
    this.isLoading.set(true);
  }
  private hideLoading(): void {
    this.isLoading.set(false);
  }

  private showError(message: string): void {
    this.errorMsg.set(message);
    this.successMsg.set('');
  }

  private hideError(): void {
    this.errorMsg.set('');
  }

  private showSuccess(message: string): void {
    this.successMsg.set(message);
    this.errorMsg.set('');
  }

  /** Format file size */
  // private formatFileSize(bytes: number):void {
  //   if (!bytes) return '0 Bytes';
  //   const k = 1024;
  //   const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  //   const i = Math.floor(Math.log(bytes) / Math.log(k));
  //   return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  // }
}
