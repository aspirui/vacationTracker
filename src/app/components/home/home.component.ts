import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { VacationService } from '../../services/vacation.service';
import { UserModel } from '../../models/user.model';
import { DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { FormControl, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { MyDateAdapter } from '../../adapters/date_adapter';
import { Subscription } from 'rxjs';
import * as _moment from 'moment';
import { UsersService } from '../../services/users.service';
import { ToastrService } from 'ngx-toastr';
const moment = _moment;

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  providers: [
    {provide: DateAdapter, useClass: MyDateAdapter, deps: [MAT_DATE_LOCALE]},
    // {provide: MAT_DATE_FORMATS, useValue: MY_FORMATS}
  ]
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit {
  vacationForm:        FormGroup;
  vacationCommentForm: FormGroup;
  user:                UserModel;
  color           = 'primary';
  mode            = 'indeterminate';
  minDate         = new Date(Date.now());
  minDate1        = new Date(Date.now());
  id              = localStorage.getItem('id');
  errorMsg:       string;
  daysTaken:      number;
  refreshTrigger: string;
  observable1:    Subscription;

  constructor(private vacationService: VacationService,
              private formBuilder: FormBuilder,
              private cd: ChangeDetectorRef,
              private userService: UsersService,
              private toastr: ToastrService) { }

  ngOnInit() {
    this.vacationFormInitialize();
    this.getVacationDays();
    this.onChanges();
  }

  ngAfterViewInit() {
    this.cd.detectChanges();
  }

  getVacationDays() {
    const id = localStorage.getItem('id');
    this.vacationService.getVacationDays(id).subscribe(
      (res) => this.onSuccess(res),
      (err) => this.onError(err)
    );
  }

  vacationFormInitialize() {
    const daysTaken = new FormControl({value: 0,   disabled: true }, [Validators.required]);
    const reason    = new FormControl({value: '',   disabled: false }, [Validators.required]);

    this.vacationForm = this.formBuilder.group({
      startDate: new FormControl({value: '', disabled: true }, [Validators.required]),
      endDate:   new FormControl({value: '', disabled: true }, [Validators.required]),
      daysTaken: daysTaken,
    });
    this.vacationCommentForm = this.formBuilder.group({
      reason:    reason,
    });
    // console.log('this vacation', this.vacationForm, this.vacationCommentForm);
  }

  onChanges() {
    this.observable1 = this.vacationForm.valueChanges.subscribe( (val) => {
      // console.log('val', val);
      const date = moment(val['startDate']);
      if (val['startDate'] !== '') {
        this.minDate1 = new Date(moment.utc(date).toDate());
      } else if (val['daysTaken'] !== 0) {
        this.minDate1 =  new Date(Date.now());
      }
      // console.log('date', date);
      // console.log('minDae', this.minDate1);
      if (val['startDate'] !== '' && val['endDate'] !== '') {
        const startDate  = moment(val['startDate']);
        const endDate    = moment(val['endDate']);
        const daysDiff   = startDate.diff(endDate.add(1, 'days'), 'days');
        if (daysDiff > 0) {
          this.toastr.error('You cannot request days in the past!', 'Error!');
        } else {
          this.daysTaken = Math.abs(daysDiff);
        }
      }
    });
  }

  reinitializeDates() {
    this.minDate   = new Date(Date.now());
    this.minDate1  = new Date(Date.now());
  }

  onSubmit(form) {
    for (const index = moment(form.startDate); index <= moment(form.endDate); index.add(1, 'days')) {
      const currentDay = index;
      // Remove Saturday and Sunday from counter of days
      if (currentDay.day() === 6 || currentDay.day() === 0) {
        this.daysTaken--;
      }
    }

    form.daysTaken   = this.daysTaken;
    form.createdBy   = this.id;
    form.isApproved  = undefined;
    form.isCancelled = false;
    form.approvedBy  = '';
    form.reason      = this.vacationCommentForm.value.reason;

    this.vacationService.requestVacation(form).subscribe(
      (res) => this.onSuccessRequestVacation(res),
      (err) => this.onError(err)
    );
  }

  onSuccessRequestVacation(res): any {
    // console.log('res', res);
     const id            = localStorage.getItem('id');
     const daysLeft      = this.user.daysLeft - Number(res.daysTaken);
     this.refreshTrigger = daysLeft.toString();
     this.reinitializeDates();
     this.vacationFormInitialize();
     this.onChanges();
     this.userService.getUser(id).subscribe(
      (result) => {
        const user = result;
        user['daysLeft'] = daysLeft;
        // console.log('updated User', user);
        this.vacationService.setVacationDays(user).subscribe(
          (res1) => this.onSuccessSetDays(res1),
          (err) => this.onError(err)
        );
      });
  }

  onSuccessSetDays(res) {
    this.user = res;
    this.toastr.success('You have requested your vacation!', 'Success!');
  }

  onSuccess(res) {
    this.user = res;
    this.toastr.success(`You have ${this.user['daysLeft']} days left!`);
  }

  onError(err) {
    console.log('err', err);
    this.toastr.error('Something got wrong, please try again!', 'Error!');
  }

  ngOnDestroy() {
    this.observable1.unsubscribe();
  }
}
