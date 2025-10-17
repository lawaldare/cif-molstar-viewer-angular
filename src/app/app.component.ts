import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  signal,
  computed,
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
  public modelSym = signal<any>(null);
  public modelSymParam = computed(() => {
    const cell = this.modelSym()?.spacegroup?.cell;
    return cell?.anglesInRadians?.map((r: any) => r * (180 / Math.PI));
  });
  public simplifiedSpacegroup = computed(() => {
    const raw = this.modelSym()?.spacegroup?.name?.trim() ?? '';
    return raw ? raw.split(/\s+/).slice(0, 2).join(' ') : '—';
  });

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

      // 🔴 Catch Mol* internal errors here
      this.plugin.plugin.events.log.subscribe((e: any) => {
        if (e.type === 'error') {
          this.showError(`Mol* error: ${e.message}`);
          this.plugin.plugin.clear();
          this.currentFile = null;
          this.hideLoading();
        } else {
          this.showSuccess('Structure loaded successfully');
        }
      });

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

      this.plugin.plugin.clear();

      await this.plugin.loadStructureFromData(fileContent, 'mmcif');

      const data =
        this.plugin.plugin.managers.structure.hierarchy.current.structures[0];
      if (!data) return;

      const model = data.cell?.obj?.data.models?.[0] || data.cell?.obj?.data;
      if (!model) return;

      // Extract cell and symmetry info
      const modelSym = model._staticPropertyData?.model_symmetry;
      this.modelSym.set(modelSym);
      // if (modelSym?.spacegroup?.cell) {
      //   const cell = modelSym.spacegroup.cell;
      //   const [a, b, c] = cell.size;
      //   const [alpha, beta, gamma] = cell.anglesInRadians.map(
      //     (r: any) => r * (180 / Math.PI)
      //   );
      //   const spacegroup = modelSym.spacegroup.name;
      //   const volume = cell.volume;

      //   console.log('A:', a.toFixed(2));
      //   console.log('B:', b.toFixed(2));
      //   console.log('C:', c.toFixed(2));
      //   console.log('Alpha:', alpha.toFixed(2));
      //   console.log('Beta:', beta.toFixed(2));
      //   console.log('Gamma:', gamma.toFixed(2));
      //   console.log('Space group:', spacegroup);
      //   console.log('Volume:', volume.toFixed(2));
      // }

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
